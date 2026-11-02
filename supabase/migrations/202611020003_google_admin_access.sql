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
