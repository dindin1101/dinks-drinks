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
