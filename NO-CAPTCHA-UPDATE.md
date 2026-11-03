# Owner-requested CAPTCHA removal

The booking flow no longer loads Google reCAPTCHA or requires a token. Frontend
and create-booking must both be updated. The hidden website honeypot is still
required/checked in the browser and server. Server price/date/proof/slot checks,
atomic court conflicts, Open Play capacity and the DB per-email/mobile throttle
are unchanged. Origin checking is NOT authentication: non-browser clients can
forge it. Honeypots can be bypassed and rotating emails/mobile numbers can bypass
identity-based throttles. Bot resistance is weaker without CAPTCHA. No claim of
strong bot protection, IP limits, WAF or new timing protection is made.

Deploy current create-booking first (Dashboard import remains ./file2.ts), JWT OFF,
then the website. Old clients with token+blank website are still accepted by the
new function, so this order avoids blocking bookings. New clients cannot submit
to the OLD function that still requires CAPTCHA. Keep BOOKING_ORIGIN unchanged.
The existing RECAPTCHA_SECRET_KEY and RECAPTCHA_HOSTNAME are unused by the new
function; no need to rotate/change/delete them as part of this deployment. They
may be removed later after confirming no other integrations use them.

No additional SQL is needed specifically for CAPTCHA removal. The rates/hours
migration010 in this PR still must be applied for the rate/allocation changes.
Apps Script email signing/secrets are unchanged; Google admin login is unaffected.

Five tests:
1. Booking page shows no CAPTCHA checkbox and loads no Google CAPTCHA script.
2. Submit an OTC test booking with blank honeypot and no token: reaches database.
3. Filled/missing honeypot or wrong browser origin: no booking inserted.
4. Invalid/stale price, occupied court and over-capacity Open Play remain rejected;
   email/mobile throttle still applies and retries are not new email notifications.
5. Successful booking keeps nickname privacy and sends the signed email. Check
   Inbox/Spam and the outbox; CAPTCHA removal does not fix unrelated mail errors.
