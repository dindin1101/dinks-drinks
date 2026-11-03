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
