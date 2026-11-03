# Business Gmail booking emails (Apps Script)

Sender account: dinksdrinks.bookings@gmail.com. This address is visible to
customers, who can reply. Personal admin Gmail accounts are not the sender.
There is no domain purchase for this approach, but Apps Script/MailApp daily
quotas and service terms apply; delivery and continuing free availability are
not guaranteed. Demo bookings never send mail.

## 1. Apps Script handler
Keep your existing setupEmailSecurity/rotateEmailSecret functions and the
BOOKING_EMAIL_SECRET Script Property. The exposed old key must be rotated;
never commit the real key or paste it in chat.

Append the contents of `integrations/google-apps-script/Code.gs` below the
existing functions, save. Do not click Run for doPost (it requires a request).

Deploy → New deployment → gear/select type → Web app:
- Execute as: Me (business Gmail account)
- Who has access: Anyone (not "Anyone with a Google account")
- Deploy; review/authorize the mail permission as the business account.
- Copy the deployed **Web app URL**, ending `/exec`, not editor URL or `/dev`.

The endpoint is public but refuses mail requests without the server's HMAC
signature. It accepts only a bounded, timestamped booking event and uses fixed
plain-text templates. It does not accept custom subject/body or attachments.
Do not deploy an unprotected generic email endpoint.

When updating the handler, Deploy → Manage deployments → Edit → New version
→ Deploy. Keep the same deployment URL where possible.

## 2. Supabase secrets (server-only)
Edge Functions → Secrets:
- BOOKING_EMAIL_SECRET: same current key as Apps Script
- BOOKING_EMAIL_URL: deployed Apps Script `/exec` URL

No email secrets go in assets/js/config.js. This does not need an App Password,
Google Drive access, personal mailbox access, or a Gmail password in Supabase.

## 3. Database and functions (apply before deploying the website)
Existing database: apply the atomic booking safety migration 004 if not done,
then run `supabase/migrations/202611020005_booking_emails.sql` in SQL Editor.
Do not re-run the entire schema over existing settings. Migration 005 adds
customer_email and a private booking_email_outbox; no historical emails are sent.
New website requests require a customer email; old bookings may retain NULL.

Deploy the function directories (including their `_shared` dependency):
- `supabase functions deploy create-booking --no-verify-jwt`
- `supabase functions deploy send-booking-emails --no-verify-jwt`

The public booking function still requires CAPTCHA; the separate mail worker
validates a real Supabase user and the approved-Google admin RPC. Never disable
those checks. Existing BOOKING_ORIGIN, reCAPTCHA and Supabase secrets remain needed.

Then deploy this branch's static files. Do not publish a customer_email form
against a database that has not received migration 005.

## Behavior and failure handling
- A database trigger queues a fixed snapshot only on booking insert/status change.
  The queue transaction rolls back if the booking fails (no false confirmation).
- The booking endpoint commits first and starts best-effort background delivery.
- Admin status changes request the authenticated mail worker. Queue failure does
  not undo a saved status change.
- The dashboard's Retry queued booking emails button processes up to five eligible
  jobs. There is no periodic background scheduler in this version.
- SQL row leases prevent workers from claiming the same event simultaneously.
- Timestamped HMAC signatures reject unsigned/expired requests. Persistent event
  IDs suppress repeated sends. MailApp quota exhaustion leaves jobs queued.
- The queue allows up to five attempts, with delays, for events under six days old.
  Script dedupe markers are retained seven days. Old/stuck jobs need staff review.
- If sending has an uncertain outcome, the script does not send it again blindly.
  Check Gmail Sent and the outbox before manual action; exactly-once delivery
  cannot be guaranteed across Gmail and the database.
- Outbox state 'sent' means accepted by the script/MailApp, NOT proof the customer
  received/read it. Failed emails do not free a booked slot.
- Three recent bookings per mobile/email per 30 minutes are allowed for new
  email-bearing bookings. CAPTCHA and existing DB protections remain necessary;
  this is not comprehensive IP/gateway rate limiting.
- Receipt paths, mobile numbers, private notes and names are NOT sent to Apps
  Script or email. Emails contain reference, schedule, status, total and policy.
  Customer email/outbox data should be included in your privacy/retention policy.

## Tests before launch
1. Place a test counter booking with your email. Verify pending booking, one queue
   event and one email. No mail should be sent for a rejected court conflict.
2. Confirm then cancel as approved admin: check distinct status messages. Clicking
   the same status twice must not queue redundant email.
3. Call Apps Script without a signature: it must not send anything. Replay a valid
   event ID: no second email. Unapproved user calling the worker must be denied.
4. Temporarily unset BOOKING_EMAIL_URL: booking still saves and queue stays pending.
   Restore the URL and use Retry queued booking emails.
5. Test quota/network failure handling and mobile form validation. Do not put real
   passwords, receipts or secrets in test payloads or screenshots.

Automated local checks:
- `node tests/booking-email.cjs` (mock Apps Script API + real HMAC)
- `tests/booking-safety.cjs` (test-only PGlite; executes SQL and queue behavior)
Real Google deployment, inbox delivery, Supabase auth and concurrent requests
still require end-to-end staging tests before production release.
