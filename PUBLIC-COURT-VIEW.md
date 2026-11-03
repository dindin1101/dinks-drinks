# Public Court View

Public URL: `/courts`. Linked from Home, Booking, and admin sidebars.

New bookings require a 2–30 character public nickname/team name. The booking form
explicitly explains that everyone can see it after confirmation; this is a booking
alias, not account registration or a unique/verified identity. Customer full names,
contacts, reference IDs, email, payment data, notes and proof never enter the public
projection. Existing bookings stay unchanged and appear as Reserved when confirmed.
Pending slots show Awaiting confirmation without aliases. Cancelled rows disappear.
Court rental slots only: Open Play and unrecorded walk-ins are not represented.
Use Scheduled now, never Playing now: attendance/check-in has not been implemented.
Date selector and one-minute visible-page refresh use Philippine time. Failed refresh
clears stale results rather than showing an out-of-date availability claim.

## Deployment order (existing installation)
1. Apply `supabase/migrations/202611030007_public_court_board.sql` in Supabase SQL
   Editor. Do not rerun the complete schema. The migration is independent of email
   migration006, which is still needed for editable emails.
2. Update `create-booking` Edge Function from
   `supabase/functions/create-booking/index.ts`. Preserve the existing email helper
   import convention if deployed through Dashboard (`./file2.ts`). Keep JWT
   verification OFF as before; reCAPTCHA/origin enforcement remain active. No new
   secrets. Do not replace the reCAPTCHA secret with a hostname.
3. Merge/deploy the website changes. Older Edge Function code silently drops the
   nickname, so step 2 is required before accepting new nickname bookings.

## Five owner tests
1. Open `/courts` signed out: Court 1/2/3, date and Refresh appear; mobile stacks.
2. Book a test slot with public alias Team Smash. Missing/overlong aliases fail;
   pending slot says Awaiting confirmation, not the name.
3. Confirm through admin: alias and court-hour appear publicly. Full customer name,
   phone, email, payment proof/reference must never appear publicly.
4. Cancel: slot disappears after Refresh. Existing confirmed bookings without an
   alias show Reserved, never an inferred alias from full name.
5. Change date, return to today and refresh. Philippine-time Scheduled now marker
   is based on schedule only. Simulate failure: schedule unavailable, no stale list.

Local PGlite regression tests cover SQL/schema, anonymous RPC permissions, private
columns excluded, pending/confirmed/cancelled visibility, historical date bounds,
and nickname length constraint. Real Edge CAPTCHA, mobile layout and live Supabase
checks still require deployment and owner testing; no real GCash payment required.

## Simplified owner SQL step
For the already-running site, use ONE file:
`supabase/updates/20261103_existing_site_update.sql`.
Paste the entire contents into a NEW SQL Editor query and Run. It combines
migrations006–009 in one transaction, retains custom settings and existing
bookings, and prevents accidentally finishing with an older email queue trigger.
Do not use the old email setup query or re-run schema.sql instead. Applying this
bundle alone does not deploy /courts or update Apps Script/Edge Functions.
The bundle is regression-tested for repeat application and nickname-only public
projection. Screenshot of Success must correspond to this query, not an old tab.

## Illustrated board refresh
The public page now shows local SVG top-view court illustrations with net and
pickleball markings, current/next rental summaries, pending/confirmed text badges,
and native expandable daily schedules. The drawing is explicitly labeled an
illustration, not an actual venue photo or live CCTV. Empty rental schedules do
NOT assert actual availability: Open Play and unrecorded walk-ins remain excluded.
Pending aliases are hidden in the UI as well as the existing RPC. All public text
is inserted with textContent, not HTML. Uses the same RPC and existing settings;
no new migration, secret, Edge Function or Apps Script change is needed.

Five checks after website deployment:
1. On /courts at desktop and ~390px, confirm Court 1/2/3 visuals and no overflow.
2. Tap or keyboard-focus each court, press Enter/Space; day schedule expands.
3. Confirmed current hour shows Scheduled now and nickname; next row shows next
   slot. Pending slots show Awaiting confirmation, never the submitted nickname.
4. Select future/past date: no Scheduled now label; empty schedule asks staff for
   availability, not a guaranteed Available claim. Refresh failure clears cards.
5. Confirm Home/Book Now work and recording remains disabled Coming soon.

`node tests/court-board.cjs` covers visual card DOM, current/next summaries,
private pending names, safe text handling, day switching and configured court count.
Actual mobile/browser and deployed Supabase checks still require visual testing.
