# Updated rates and court allocation

Requested rates: court PHP250/hour, Open Play PHP150/person/session, paddle PHP80
(existing per-booking/per-hour setting retained), ball PHP50 each.

Court 1 rental 05:00–24:00. Implementation assumption pending owner clarification:
Courts 2 and 3 remain rentable 05:00–18:00, then allocated to Open Play 18:00–22:00,
not rented again after 22:00. Both frontend and database reject their evening
rental slots. Existing future evening reservations are NOT deleted: migration010
aborts with EXISTING_EVENING_RENTALS for owner review instead of reallocating them.
Open Play capacity is unchanged (24 combined, not 24 per court).

Ball price is shown as a counter purchase and editable in Settings. It is NOT a
booking add-on and does not silently increase a customer's total. Quantity/online
purchase workflow remains deferred until the owner confirms scope.

Names/nicknames are proper-cased on input blur, submission, trusted Edge validation
and new database writes; admin/Court View display and report CSV normalize old
names for display without repricing historical reservations. Proper-case rules are
mechanical and may alter intentional capitalization/initialisms. Full names stay
private. Dates display as Nov. 03, 2026; stored booking dates stay YYYY-MM-DD, not UTC
conversions. Native browser date-picker appearance remains browser/locale-dependent.
Money display includes two decimals. Midnight is correctly shown as 12AM in emails.

CAPTCHA: owner subsequently explicitly requested removal. See NO-CAPTCHA-UPDATE.md.
No CAPTCHA widget/token or Google verification call remains. Honeypot, database
throttling, origin check, price validation, proof checks and atomic booking rules
remain; bot resistance is weaker without CAPTCHA.

## Deployment order
1. Supabase SQL Editor: apply ONLY migration
   `supabase/migrations/202611030010_court_rates_and_hours.sql`.
   Do not rerun schema.sql or the previous combined bundle as an alternative.
   This intentionally updates owner-requested rates/hours and preserves booking
   totals. Review any preflight error before proceeding; never auto-cancel bookings.
2. Deploy current create-booking Edge Function, preserving the Dashboard email
   helper import `./file2.ts` if applicable and existing JWT OFF setting.
3. Deploy website from this PR. Existing Settings override demo defaults, so merely
   deploying frontend does NOT update live prices. Migration010 is required.
4. Update Code.gs and edit existing Apps Script deployment to a New version at the
   same URL for abbreviated email dates/midnight labeling. No keys to change.

## Five owner checks
1. Settings/Home/Booking: court250.00, Open Play150.00, paddle80.00, ball50.00.
2. Future date: select Court1 5–6AM and 11PM–midnight; server accepts valid totals.
   Court2/3 5–6PM accepted, 6PM onward disabled and rejected server-side.
3. Open Play is 6–10PM on Courts2/3, price pax*150; stale100 totals rejected.
   Court1 stays independently rentable during Open Play; capacity unchanged.
4. Mixed-case name/nickname becomes Proper Case. Date summaries/email show
   Nov. 03, 2026 format; public board reveals only confirmed chosen nicknames.
5. Paddle1 adds80 in flat mode; ball is a counter-price notice and not included.
   No CAPTCHA is required; keep the honeypot blank and verify email delivery and
   max-two limit on a NEW reference, not repeated status toggles.

Local tests cover SQL rates, exclusions, dawn/midnight, proper case, price tampering,
Open Play limits, display formatting, settings, email HTML/signing, public privacy,
notifications and mocked Edge honeypot/origin. Actual mobile and deployed E2E need review.
