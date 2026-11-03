-- ============================================================
--  DINKS & DRINKS PICKLEBALL ZONE — Supabase setup
--  HOW TO USE: Supabase Dashboard → SQL Editor → New query
--  → paste this whole file → RUN. (Safe to re-run.)
-- ============================================================

-- ---------- BOOKINGS ----------
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  booking_ref   text unique not null,
  customer_name text not null,
  mobile        text not null,
  booking_type  text not null check (booking_type in ('court','openplay')),
  date          date not null,
  court_number  int,
  start_hour    int not null,
  end_hour      int not null,
  slots         jsonb not null default '[]'::jsonb,   -- [{court, hour}, ...] for court rentals
  pax           int,
  rent_paddle   boolean not null default false,
  paddle_qty    int not null default 0,
  court_amount  numeric not null default 0,
  paddle_amount numeric not null default 0,
  total_amount  numeric not null default 0,
  payment_method text not null check (payment_method in ('gcash','counter')),
  gcash_ref     text,
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_bookings_date on public.bookings (date);
create index if not exists idx_bookings_status on public.bookings (status);

-- ---------- SETTINGS (prices, GCash number, hours...) ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

insert into public.settings (key, value) values
  ('business_name', '"Dinks & Drinks"'),
  ('tagline', '"Pickleball Zone"'),
  ('location', '"Brgy. Magsaysay, Naguilian, Isabela"'),
  ('contact_number', '"+63 917 708 2805"'),
  ('facebook_url', '"https://www.facebook.com/dinksNdrinks"'),
  ('messenger_url', '"https://m.me/dinksNdrinks"'),
  ('gcash_number', '"0917 708 2805"'),
  ('gcash_name', '"Dinks & Drinks Pickleball Zone"'),
  ('courts', '3'),
  ('settings_rev', '2'),
  ('court_open_hour', '8'),
  ('court_close_hour', '17'),
  ('open_hour', '18'),
  ('close_hour', '22'),
  ('court_rate', '250'),
  ('openplay_rate', '100'),
  ('paddle_rate', '100'),
  ('paddle_per', '"booking"'),
  ('openplay_capacity', '24'),
  ('openplay_sessions', '[{"id":"openplay","label":"Open Play","start_hour":18,"end_hour":22}]')
on conflict (key) do update set value = excluded.value;

-- ---------- PUBLIC AVAILABILITY VIEW ----------
-- Customers only need to know WHICH slots are taken — never names/phones.
-- This view exposes only slot info (no personal data).
create or replace view public.public_availability
  with (security_invoker = false) as
  select booking_type, date, court_number, start_hour, end_hour, slots, pax, status
  from public.bookings;

grant select on public.public_availability to anon, authenticated;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.bookings enable row level security;
alter table public.settings enable row level security;

-- Public bookings go through the CAPTCHA-verifying Edge Function only.
drop policy if exists "anon can create booking" on public.bookings;
revoke insert on public.bookings from anon;

-- Bookings: only the logged-in owner (authenticated) can read/update/delete.
drop policy if exists "owner full access bookings" on public.bookings;
create policy "owner full access bookings"
  on public.bookings for all
  to authenticated
  using (true)
  with check (true);

-- Settings: anyone may READ (so the booking page shows prices/GCash no.).
drop policy if exists "public can read settings" on public.settings;
create policy "public can read settings"
  on public.settings for select
  to anon, authenticated
  using (true);

-- Settings: only the logged-in owner can change them.
drop policy if exists "owner can write settings" on public.settings;
create policy "owner can write settings"
  on public.settings for insert
  to authenticated
  with check (true);

drop policy if exists "owner can update settings" on public.settings;
create policy "owner can update settings"
  on public.settings for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "owner can delete settings" on public.settings;
create policy "owner can delete settings"
  on public.settings for delete
  to authenticated
  using (true);

-- ============================================================
--  DONE! Next steps (see README.md):
--  1) Authentication → Users → Add user (your owner email/password)
--  2) Settings → API → copy Project URL + anon key into
--     assets/js/config.js
-- ============================================================
-- Does not change existing bookings. Receipts are private, not public URLs.
alter table public.bookings add column if not exists payment_proof_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1048576,
allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "owner can read payment proofs" on storage.objects;
create policy "owner can read payment proofs" on storage.objects for select
to authenticated using (bucket_id = 'payment-proofs');
-- Anonymous users get no direct upload/read policy. The CAPTCHA-verified
-- function uploads through its server-only service role after checking the file.
insert into public.settings (key, value) values ('gcash_qr_url', '""'::jsonb)
on conflict (key) do nothing;
-- Approved Google accounts only. Safe to re-run; no bookings are deleted.
begin;
create or replace function public.is_dnd_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'provider') = 'google'
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.email_confirmed_at is not null
        and lower(u.email) in ('lopezeden1101@gmail.com', 'dcchamie25@gmail.com')
    ), false);
$$;
revoke all on function public.is_dnd_admin() from public;
grant execute on function public.is_dnd_admin() to authenticated;

drop policy if exists "owner full access bookings" on public.bookings;
create policy "owner full access bookings" on public.bookings for all to authenticated
using ((select public.is_dnd_admin())) with check ((select public.is_dnd_admin()));

drop policy if exists "owner can write settings" on public.settings;
create policy "owner can write settings" on public.settings for insert to authenticated
with check ((select public.is_dnd_admin()));
drop policy if exists "owner can update settings" on public.settings;
create policy "owner can update settings" on public.settings for update to authenticated
using ((select public.is_dnd_admin())) with check ((select public.is_dnd_admin()));
drop policy if exists "owner can delete settings" on public.settings;
create policy "owner can delete settings" on public.settings for delete to authenticated
using ((select public.is_dnd_admin()));

drop policy if exists "owner can read payment proofs" on storage.objects;
create policy "owner can read payment proofs" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and (select public.is_dnd_admin()));
commit;
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
begin;
alter table public.bookings add column if not exists customer_email text;
-- Existing bookings can keep a NULL email. New website bookings supply one.
alter table public.bookings drop constraint if exists bookings_customer_email_valid;
alter table public.bookings add constraint bookings_customer_email_valid check (
  customer_email is null or (
    length(customer_email) <= 254
    and customer_email ~ '^[A-Za-z0-9._%+!-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);
create table if not exists public.booking_email_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.booking_email_outbox enable row level security;
revoke all on public.booking_email_outbox from anon, authenticated;
grant all on public.booking_email_outbox to service_role;

create or replace function public.queue_booking_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.customer_email is null then return NEW; end if;
  if TG_OP = 'INSERT' and (
    (select count(*) from public.bookings where created_at > now()-interval '30 minutes'
      and (lower(customer_email) = lower(NEW.customer_email) or mobile = NEW.mobile)) > 3
  ) then raise exception using errcode='P0001', message='BOOKING_RATE_LIMIT'; end if;
  if TG_OP = 'UPDATE' and OLD.status = NEW.status then return NEW; end if;
  insert into public.booking_email_outbox(booking_ref,payload) values (
    NEW.booking_ref,
    jsonb_build_object('to',NEW.customer_email,'ref',NEW.booking_ref,
      'status',NEW.status,'date',NEW.date,'type',NEW.booking_type,
      'start_hour',NEW.start_hour,'end_hour',NEW.end_hour,'slots',NEW.slots,
      'total',NEW.total_amount,'payment',NEW.payment_method)
  );
  return NEW;
end;
$$;
revoke all on function public.queue_booking_email() from public;
drop trigger if exists queue_booking_email on public.bookings;
create trigger queue_booking_email after insert or update of status on public.bookings
for each row execute function public.queue_booking_email();

-- Only the server can claim jobs. Row locks prevent two workers claiming one job.
create or replace function public.claim_booking_emails(p_ref text)
returns setof public.booking_email_outbox
language sql security definer set search_path = '' as $$
  update public.booking_email_outbox o set state='sending', attempts=o.attempts+1,
    available_at=now()+interval '2 minutes'
  where o.id in (
    select id from public.booking_email_outbox
    where (p_ref is null or booking_ref=p_ref)
      and state in ('pending','sending') and available_at <= now()
      and attempts < 5 and created_at > now()-interval '6 days'
    order by created_at limit 5 for update skip locked
  ) returning o.*;
$$;
revoke all on function public.claim_booking_emails(text) from public, anon, authenticated;
grant execute on function public.claim_booking_emails(text) to service_role;
commit;

-- Editable plain-text email messages. Preserves existing owner settings and queued emails.
begin;
insert into public.settings (key,value) values
  ('email_pending_message', '"Thank you for booking with Dinks & Drinks. We have received your request and will review it shortly."'::jsonb),
  ('email_confirmed_message', '"Your booking is confirmed. Please arrive 15 minutes before your scheduled game and keep your reference handy."'::jsonb),
  ('email_cancelled_message', '"Your booking has been cancelled. Please contact our team if you have questions about your booking or payment."'::jsonb),
  ('email_footer', '"Questions? Reply to this business email or message https://www.facebook.com/dinksNdrinks"'::jsonb)
on conflict (key) do nothing;

create or replace function public.queue_booking_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.customer_email is null then return NEW; end if;
  if TG_OP = 'INSERT' and (
    (select count(*) from public.bookings where created_at > now()-interval '30 minutes'
      and (lower(customer_email) = lower(NEW.customer_email) or mobile = NEW.mobile)) > 3
  ) then raise exception using errcode='P0001', message='BOOKING_RATE_LIMIT'; end if;
  if TG_OP = 'UPDATE' and OLD.status = NEW.status then return NEW; end if;
  insert into public.booking_email_outbox(booking_ref,payload) values (
    NEW.booking_ref,
    jsonb_build_object('to',NEW.customer_email,'ref',NEW.booking_ref,
      'status',NEW.status,'date',NEW.date,'type',NEW.booking_type,
      'start_hour',NEW.start_hour,'end_hour',NEW.end_hour,'slots',NEW.slots,
      'total',NEW.total_amount,'payment',NEW.payment_method,
      'email_message',left((select value #>> '{}' from public.settings
        where key='email_' || NEW.status || '_message'),1600),
      'email_footer',left((select value #>> '{}' from public.settings
        where key='email_footer'),800))
  );
  return NEW;
end;
$$;
commit;
-- Only explicitly provided nicknames are public. Never backfill from customer_name.
alter table public.bookings add column if not exists public_nickname text;
alter table public.bookings drop constraint if exists bookings_public_nickname_check;
alter table public.bookings add constraint bookings_public_nickname_check check (
  public_nickname is null or (char_length(btrim(public_nickname)) between 2 and 30
    and public_nickname !~ '[[:cntrl:]]')
);

-- Narrow public projection: no IDs, full names, email, mobile, notes or payment data.
create or replace function public.court_board(p_date date)
returns table(court integer, hour integer, label text, booking_status text)
language sql stable security definer set search_path = '' as $$
  select distinct (s.value->>'court')::integer, (s.value->>'hour')::integer,
    case when b.status = 'confirmed' then coalesce(nullif(btrim(b.public_nickname), ''), 'Reserved')
      else 'Awaiting confirmation' end,
    b.status::text
  from public.bookings b
  cross join lateral jsonb_array_elements(b.slots) s
  where b.date = p_date and b.booking_type = 'court' and b.status in ('pending','confirmed')
    and p_date between (now() at time zone 'Asia/Manila')::date - 30
      and (now() at time zone 'Asia/Manila')::date + 365
  union
  select b.court_number::integer, h::integer,
    case when b.status = 'confirmed' then coalesce(nullif(btrim(b.public_nickname), ''), 'Reserved')
      else 'Awaiting confirmation' end, b.status::text
  from public.bookings b cross join lateral generate_series(b.start_hour,b.end_hour-1) h
  where b.date = p_date and b.booking_type = 'court' and b.status in ('pending','confirmed')
    and jsonb_array_length(b.slots)=0
    and p_date between (now() at time zone 'Asia/Manila')::date - 30
      and (now() at time zone 'Asia/Manila')::date + 365;
$$;
revoke all on function public.court_board(date) from public;
grant execute on function public.court_board(date) to anon, authenticated;
-- Add owner-approved Google admin without granting access to arbitrary signups.
begin;
create or replace function public.is_dnd_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'provider') = 'google'
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.email_confirmed_at is not null
        and lower(u.email) in (
          'lopezeden1101@gmail.com',
          'dcchamie25@gmail.com',
          'rplopez.cpa@gmail.com'
        )
    ), false);
$$;
revoke all on function public.is_dnd_admin() from public;
grant execute on function public.is_dnd_admin() to authenticated;
commit;
