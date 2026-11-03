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
