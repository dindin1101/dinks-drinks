-- Dinks & Drinks: one-time existing-site update (006 through 009).
-- Paste this ENTIRE file into a NEW Supabase SQL Editor query and Run.
-- Requires the existing booking/email setup (migration005). Not the whole schema.
-- No bookings are deleted. Existing custom settings are preserved.
-- Excess old pending email jobs after two per booking are stopped, not deleted.
-- Full names/contact/payment data are NEVER included in the public court board.
begin;
do $$
begin
  if to_regclass('public.booking_email_outbox') is null then
    raise exception 'Existing email setup (migration005) is required. No changes applied.';
  end if;
end;
$$;

-- ===== 202611030006_editable_email_messages.sql =====
-- Editable plain-text email messages. Preserves existing owner settings and queued emails.
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

-- ===== 202611030007_public_court_board.sql =====
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

-- ===== 202611030008_add_approved_admin.sql =====
-- Add owner-approved Google admin without granting access to arbitrary signups.
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

-- ===== 202611030009_limit_booking_emails.sql =====
-- At most two queued notification jobs per booking reference. Never delete the
-- outbox history to reset this limit. Existing delivered mail cannot be recalled.
create or replace function public.queue_booking_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.customer_email is null then return NEW; end if;
  if TG_OP = 'INSERT' and (
    (select count(*) from public.bookings where created_at > now()-interval '30 minutes'
      and (lower(customer_email) = lower(NEW.customer_email) or mobile = NEW.mobile)) > 3
  ) then raise exception using errcode='P0001', message='BOOKING_RATE_LIMIT'; end if;
  if TG_OP = 'UPDATE' and OLD.status = NEW.status then return NEW; end if;
  -- Status updates on the same booking hold its row lock, serializing this check.
  -- Count all jobs, including failed/uncertain ones: retry is not a new email.
  if (select count(*) from public.booking_email_outbox where booking_ref=NEW.booking_ref) >= 2
    then return NEW; end if;
  -- Only receipt plus the first decision; reverting to pending never emails again.
  if TG_OP = 'UPDATE' and NEW.status = 'pending' then return NEW; end if;
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

-- Stop excess old queued jobs. Already in-flight sends cannot be recalled.
with ranked as (
  select id, row_number() over (partition by booking_ref order by created_at,id) as n
  from public.booking_email_outbox
)
update public.booking_email_outbox o set state='failed', attempts=greatest(o.attempts,5)
from ranked r where o.id=r.id and r.n>2 and o.state='pending';

commit;
