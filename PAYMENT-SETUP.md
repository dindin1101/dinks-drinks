# GCash QR and receipt setup

## What changed
- Homepage court and open-play options are arranged in two labeled columns.
- `/booking` has the existing live summary: schedule, fee, paddles and total.
- GCash requires a JPG, PNG or WebP receipt up to 1 MB and the existing reference.
- Counter payments do not request a receipt.
- Receipts go to a private Supabase Storage bucket only after CAPTCHA verification.
- Team dashboard offers a short-lived receipt link to authenticated staff.

## Enable for production
1. Complete `SPAM-PROTECTION.md` first.
2. Run `supabase/migrations/202611020002_payment_proofs.sql` in Supabase SQL Editor.
   This adds a receipt path column and private bucket without changing old bookings.
3. Redeploy the updated `create-booking` Edge Function and deploy this branch's static files together.
4. Open Team Settings and set **GCash QR image URL (HTTPS)** to your real QR image's
   public HTTPS URL. Confirm the account name and GCash number too. Blank hides the QR.
   A merchant QR can be public; customer receipt images must never go in a public bucket.
5. Test a GCash booking, then open its receipt from the dashboard. An anonymous
   visitor must not be able to list or download payment-proofs objects.

## Browser checks
- At 390px and on desktop, verify the two homepage columns and no sideways scroll.
- Verify Court and Open Play buttons navigate to `/booking` in the same tab.
- Change slots, players and paddles: summary and payment total must match.
- Select GCash: missing, oversized and unsupported receipts must be rejected.
- Select a valid image: its preview should appear. Complete CAPTCHA and submit.
- Verify the pending booking and private receipt arrive; nothing auto-confirms payment.
- Select Over the Counter: no receipt required and no receipt stored.
- Test on the same phone using GCash Scan QR → Upload; verify the recipient yourself.

Demo mode validates and previews the selected receipt but does not upload or save it.
Existing bookings without receipts still work. Use Supabase Storage to delete receipts
when no longer needed under your business privacy/retention policy. There is no automatic
retention cleanup yet. Disable public Auth signups: the existing app treats authenticated
users as owners. CAPTCHA does not replace server-authoritative pricing or race-proof slots.
