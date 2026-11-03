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
