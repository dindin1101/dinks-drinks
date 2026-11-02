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
