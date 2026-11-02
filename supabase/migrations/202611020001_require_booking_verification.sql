-- Safe for existing bookings; blocks direct anonymous insertion.
begin;
drop policy if exists "anon can create booking" on public.bookings;
revoke insert on public.bookings from anon;
commit;
