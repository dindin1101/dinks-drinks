-- Owner-requested rates and court allocation. Apply before website/Edge update.
begin;
-- Never silently invalidate pre-existing evening Court 2/3 rentals.
do $$
begin
  if exists (
    select 1 from public.booking_slot_claims
    where court in (2,3) and hour >= 18
      and date >= (now() at time zone 'Asia/Manila')::date
  ) then raise exception 'EXISTING_EVENING_RENTALS: review Court 2/3 future evening rentals before assigning Open Play. No changes applied.';
  end if;
end;
$$;
insert into public.settings(key,value) values
 ('court_rate','250'::jsonb), ('openplay_rate','150'::jsonb),
 ('paddle_rate','80'::jsonb), ('ball_rate','50'::jsonb),
 ('court_open_hour','5'::jsonb), ('court_close_hour','24'::jsonb),
 ('open_hour','18'::jsonb), ('close_hour','22'::jsonb),
 ('openplay_sessions','[{"id":"openplay","label":"Open Play","start_hour":18,"end_hour":22}]'::jsonb)
on conflict(key) do update set value=excluded.value;
create or replace function public.enforce_booking_safety()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb;
  slot jsonb;
  court int;
  hour int;
  n int;
  used int;
  units int;
  base numeric;
  paddles numeric;
  expected numeric;
  local_now timestamp := clock_timestamp() at time zone 'Asia/Manila';
begin
  -- Serialize capacity decisions, cancellations and admin edits in one order.
  perform pg_advisory_xact_lock(20261102, 4);
  if TG_OP = 'DELETE' then
    if OLD.booking_type = 'openplay' and OLD.status <> 'cancelled' then
      update public.booking_session_counts set players = players - OLD.pax
      where date = OLD.date and start_hour = OLD.start_hour;
    end if;
    return OLD;
  end if;
  select jsonb_object_agg(key, value) into cfg from public.settings;

  -- Cancelling must always be possible, even after prices/hours change.
  if TG_OP = 'UPDATE' and NEW.status = 'cancelled' then
    if OLD.booking_type = 'openplay' and OLD.status <> 'cancelled' then
      update public.booking_session_counts set players = players - OLD.pax
      where date = OLD.date and start_hour = OLD.start_hour;
    end if;
    delete from public.booking_slot_claims where booking_id = OLD.id;
    return NEW;
  end if;
  -- Confirming an existing reservation does not reprice historical bookings.
  if TG_OP = 'UPDATE' and OLD.status <> 'cancelled'
     and (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') then
    return NEW;
  end if;
  NEW.customer_name := initcap(btrim(NEW.customer_name));
  if NEW.public_nickname is not null then NEW.public_nickname := initcap(btrim(NEW.public_nickname)); end if;
  if TG_OP = 'INSERT' and NEW.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
  end if;
  if NEW.date < local_now::date or NEW.date > local_now::date + 365
     or length(trim(NEW.customer_name)) not between 2 and 120
     or NEW.mobile !~ '^(09[0-9]{9}|[+]639[0-9]{9})$'
     or coalesce(length(NEW.notes),0) > 2000
     or NEW.paddle_qty not between 0 and 100
     or (not NEW.rent_paddle and NEW.paddle_qty <> 0)
     or (NEW.rent_paddle and NEW.paddle_qty < 1) then
    raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
  end if;
  if NEW.payment_method = 'gcash' and (
    coalesce(NEW.gcash_ref,'') !~ '[0-9]{6}' or NEW.payment_proof_path is null
  ) then raise exception using errcode = 'P0001', message = 'PAYMENT_PROOF_REQUIRED'; end if;

  if NEW.booking_type = 'court' then
    if jsonb_typeof(NEW.slots) <> 'array' or jsonb_array_length(NEW.slots) not between 1 and 100 then
      raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
    end if;
    n := jsonb_array_length(NEW.slots);
    if (select count(distinct (s->>'court',s->>'hour')) from jsonb_array_elements(NEW.slots) s) <> n then
      raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
    end if;
    for slot in select * from jsonb_array_elements(NEW.slots) loop
      if jsonb_typeof(slot->'court') <> 'number' or jsonb_typeof(slot->'hour') <> 'number'
         or (slot->>'court') !~ '^[0-9]+$' or (slot->>'hour') !~ '^[0-9]+$' then
        raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
      end if;
      court := (slot->>'court')::int; hour := (slot->>'hour')::int;
      if court is null or hour is null or court < 1 or court > (cfg->>'courts')::int
         or (court in (2,3) and hour >= (cfg->>'open_hour')::int)
         or hour < (cfg->>'court_open_hour')::int or hour >= (cfg->>'court_close_hour')::int
         or (NEW.date = local_now::date and hour <= extract(hour from local_now)) then
        raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
      end if;
    end loop;
    NEW.court_number := (NEW.slots->0->>'court')::int;
    select min((s->>'hour')::int), max((s->>'hour')::int)+1
      into NEW.start_hour, NEW.end_hour from jsonb_array_elements(NEW.slots) s;
    base := n * (cfg->>'court_rate')::numeric;
    units := n;
  else
    if NEW.pax is null or NEW.pax < 1 or NEW.pax > (cfg->>'openplay_capacity')::int
       or NEW.slots <> '[]'::jsonb or not exists (
         select 1 from jsonb_array_elements(cfg->'openplay_sessions') s
         where (s->>'start_hour')::int = NEW.start_hour and (s->>'end_hour')::int = NEW.end_hour
       ) or (NEW.date = local_now::date and NEW.start_hour <= extract(hour from local_now)) then
      raise exception using errcode = 'P0001', message = 'BOOKING_INVALID';
    end if;
    select coalesce(sum(pax),0) into used from public.bookings
      where date = NEW.date and booking_type = 'openplay' and start_hour = NEW.start_hour
      and status <> 'cancelled' and id <> NEW.id;
    if used + NEW.pax > (cfg->>'openplay_capacity')::int then
      raise exception using errcode = 'P0001', message = 'OPENPLAY_FULL';
    end if;
    NEW.court_number := null;
    base := NEW.pax * (cfg->>'openplay_rate')::numeric;
    units := NEW.end_hour - NEW.start_hour;
  end if;
  paddles := NEW.paddle_qty * (cfg->>'paddle_rate')::numeric
    * case when cfg->>'paddle_per' = 'hour' then units else 1 end;
  expected := base + paddles;
  -- Reject changed/tampered totals instead of silently charging a different price.
  if base is null or paddles is null or base < 0 or paddles < 0 or expected <= 0
     or NEW.court_amount <> base or NEW.paddle_amount <> paddles or NEW.total_amount <> expected then
    raise exception using errcode = 'P0001', message = 'PRICE_CHANGED';
  end if;

  if TG_OP = 'UPDATE' and OLD.booking_type = 'openplay' and OLD.status <> 'cancelled' then
    update public.booking_session_counts set players = players - OLD.pax
    where date = OLD.date and start_hour = OLD.start_hour;
  end if;
  delete from public.booking_slot_claims where booking_id = NEW.id;
  -- Claims are inserted by the AFTER trigger, after the parent row exists.
  return NEW;
end;
$$;

commit;
