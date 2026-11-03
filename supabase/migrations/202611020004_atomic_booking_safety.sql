-- Run once in SQL Editor before deploying the updated create-booking function.
-- A pre-existing court overlap aborts this transaction without deleting data.
begin;
lock table public.bookings in access exclusive mode;

create table if not exists public.booking_slot_claims (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  date date not null,
  court int not null,
  hour int not null,
  primary key (date, court, hour)
);
alter table public.booking_slot_claims enable row level security;
revoke all on public.booking_slot_claims from anon, authenticated;

-- Atomic counters prevent over-capacity even under concurrent transactions.
create table if not exists public.booking_session_counts (
  date date not null,
  start_hour int not null,
  players int not null check (players >= 0),
  primary key (date, start_hour)
);
alter table public.booking_session_counts enable row level security;
revoke all on public.booking_session_counts from anon, authenticated;
insert into public.booking_session_counts (date,start_hour,players)
select date,start_hour,sum(pax)::int from public.bookings
where booking_type = 'openplay' and status <> 'cancelled'
group by date,start_hour
on conflict (date,start_hour) do update set players = excluded.players;

-- Backfill occupied slots; the primary key rejects existing double bookings.
insert into public.booking_slot_claims (booking_id, date, court, hour)
select b.id, b.date, (s->>'court')::int, (s->>'hour')::int
from public.bookings b cross join lateral jsonb_array_elements(b.slots) s
where b.booking_type = 'court' and b.status <> 'cancelled'
and not exists (select 1 from public.booking_slot_claims c where c.booking_id = b.id);

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

create or replace function public.claim_booking_slots()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cap int; accepted int;
begin
  if TG_OP = 'UPDATE' and OLD.status <> 'cancelled'
     and NEW.status <> 'cancelled'
     and (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') then return NEW; end if;
  if NEW.booking_type = 'openplay' and NEW.status <> 'cancelled' then
    select (value #>> '{}')::int into cap from public.settings where key = 'openplay_capacity';
    insert into public.booking_session_counts as counts (date,start_hour,players)
    values (NEW.date,NEW.start_hour,NEW.pax)
    on conflict (date,start_hour) do update set players = counts.players + excluded.players
    where counts.players + excluded.players <= cap
    returning players into accepted;
    if accepted is null or accepted > cap then
      raise exception using errcode = 'P0001', message = 'OPENPLAY_FULL';
    end if;
  end if;
  if NEW.booking_type = 'court' and NEW.status <> 'cancelled' then
    insert into public.booking_slot_claims (booking_id,date,court,hour)
      select NEW.id, NEW.date, (s->>'court')::int, (s->>'hour')::int
      from jsonb_array_elements(NEW.slots) s
      on conflict (date,court,hour) do update set booking_id = excluded.booking_id
      where public.booking_slot_claims.booking_id = excluded.booking_id;
    if (select count(*) from public.booking_slot_claims where booking_id = NEW.id) <> jsonb_array_length(NEW.slots) then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
    end if;
  end if;
  return NEW;
end;
$$;
revoke all on function public.enforce_booking_safety(), public.claim_booking_slots() from public;
drop trigger if exists enforce_booking_safety on public.bookings;
create trigger enforce_booking_safety before insert or update or delete on public.bookings
for each row execute function public.enforce_booking_safety();
drop trigger if exists claim_booking_slots on public.bookings;
create trigger claim_booking_slots after insert or update on public.bookings
for each row execute function public.claim_booking_slots();
commit;
