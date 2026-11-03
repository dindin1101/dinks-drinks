-- At most two queued notification jobs per booking reference. Never delete the
-- outbox history to reset this limit. Existing delivered mail cannot be recalled.
begin;
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
