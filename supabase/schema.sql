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
