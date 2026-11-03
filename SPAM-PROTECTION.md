# Booking spam protection setup

The honeypot and Google reCAPTCHA v2 checkbox are implemented. Demo mode does
not load Google or require a CAPTCHA. Live mode fails closed until configured.
The static site still has no build step. The verification endpoint runs in
Supabase, not in the browser or Vercel.

## Before enabling live bookings

1. Register a **reCAPTCHA v2 → “I'm not a robot” Checkbox** site in Google's
   reCAPTCHA admin console. Add your production hostname (no https:// or path).
   Do not choose v3 or Enterprise keys for this implementation.
2. Put only the public **site key** in `assets/js/config.js`, in
   `RECAPTCHA_SITE_KEY`. Keep the secret out of GitHub and chat.
3. In Supabase → Edge Functions → Secrets, add:
   - `RECAPTCHA_SECRET_KEY`: Google's secret key
   - `RECAPTCHA_HOSTNAME`: your exact production hostname, e.g. example.vercel.app
   - `BOOKING_ORIGIN`: full production origin, e.g. https://example.vercel.app
   Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to hosted functions;
   never copy the service-role key into the website.
4. Deploy `supabase/functions/create-booking/index.ts` as `create-booking`.
   Disable the function's legacy JWT verification for this public endpoint.
   With the Supabase CLI, after linking your project:
   `supabase functions deploy create-booking --no-verify-jwt`
5. Existing database: run ONLY
   `supabase/migrations/202611020001_require_booking_verification.sql`
   in SQL Editor. It does not delete or modify bookings. Fresh installation:
   use `supabase/schema.sql` instead. Avoid rerunning the entire schema on an
   existing business: its existing settings seed overwrites owner settings.
6. Set the Supabase publishable key in config.js and deploy the static files.
   Do not publicly launch until the checks below pass. When changing domains,
   update Google domain registration and both hostname/origin secrets.

## Five checks before launch

1. With the Supabase key blank, make a demo booking. No checkbox is required;
   it must save only to your browser. Restore the key afterward.
2. In live mode, submit without checking reCAPTCHA: no booking should save.
   Fill the hidden `bookingWebsite` field via browser developer tools and
   submit: it should also be rejected.
3. Complete the checkbox and make a test booking: exactly one pending booking
   should appear in the owner dashboard. Retry after an expired checkbox and
   confirm a fresh check is required.
4. Send a direct anonymous insert to the bookings REST endpoint: it must fail.
   Calling the Edge Function without a valid token must fail too. Never test
   with the service-role key. Confirm owner status updates still work.
5. Check on a narrow phone screen, block Google's script and try again:
   a clear error should appear and no live booking should save.

## Scope

The server verifies Google's success result and expected hostname, rejects the
honeypot and forces pending status. No secret is sent to the browser. reCAPTCHA
is not a guarantee against human-assisted spam or request flooding; consider
rate limits for production abuse. Existing client-side price calculation and
availability checks are unchanged: they are not authoritative server-side price
validation or a race-proof reservation constraint. Those are separate hardening
work, not provided by a CAPTCHA. Authenticated owner access remains unchanged;
disable public Supabase signups so strangers cannot become authenticated owners.
Google receives browser data when the live checkbox loads; update your privacy
notice accordingly.
