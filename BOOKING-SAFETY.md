# Concurrent booking safety — deployment checklist

## Apply to the existing Supabase database
Run **only** `supabase/migrations/202611020004_atomic_booking_safety.sql` in SQL Editor.
Do not re-run the entire schema on an existing business. This migration takes a
brief exclusive bookings-table lock. Existing overlapping court bookings make the
migration fail/roll back; resolve those with the owner before retrying. It does
not silently delete, cancel or overwrite conflicting bookings.

Then redeploy `create-booking` and deploy the static files from this branch.
The earlier Google-admin and private-receipt migrations must already be applied.
The schema includes this migration for fresh installations.

## Guarantees implemented
- Private slot-claim primary key on date/court/hour. Even competing database
  transactions cannot commit overlapping active court slots.
- All slots in a multi-slot booking succeed together or none do.
- Atomic Open Play counters prevent over-capacity; pending and confirmed count.
- Cancellation/deletion releases capacity, and reactivation must acquire it again.
- Admin edits are protected too, not only the public booking page.
- Rates, allowed court hours, session hours, court numbers, paddle quantities,
  past dates and payment proof presence are checked in the database.
- Submitted totals must match current settings or the booking fails with a
  refresh/review instruction. Existing status-only confirmations do not reprice.
- Connection/availability failures no longer become empty availability or local
  demo bookings when configured for live use.
- CAPTCHA, pending-only server inserts, private receipts, approved-Google RLS
  remain in place. Failed database inserts remove the newly uploaded receipt.
- Same-tab unchanged retries reuse the booking reference. The unique reference
  prevents a duplicate insert after a lost response; duplicates instruct the
  customer to contact staff, not to pay again.

## Tests
`tests/booking-safety.cjs` uses the test-only @electric-sql/pglite package.
Set PGLITE_MODULE to an installed module path, or install it outside the site.
No package.json/build step is added to the website. The tests execute the full
schema and check court conflicts, multi-slot claims, totals, invalid dates and
slots, proof requirements, cancellations, reactivation, Open Play and rollback.
PGlite runs in one connection: these are NOT a real multi-connection load test.

Before public launch, on a staging Supabase project with separate browser sessions:
1. Submit the same slot simultaneously: exactly one succeeds, the other receives
   SLOT_UNAVAILABLE; only one booking and one private receipt should remain.
2. Submit competing Open Play groups whose total exceeds capacity: the database
   must accept only the groups that fit.
3. Cancel the winner and book that slot again. Attempt to reactivate the cancelled
   booking: it must fail if the replacement booking now occupies the slot.
4. Manipulate prices/slots in a request; the database must reject it. Disconnect
   networking: no false success or demo fallback should appear.
5. Confirm unrelated Google accounts cannot read bookings/receipts or write
   settings; test both approved accounts, receipt links and counter payments.

## Important limits
- GCash payment is external. There is NO temporary hold before payment, automatic
  payment verification or refund automation. A person can pay and then lose a
  contested slot. The page now warns them to contact staff with their reference
  and not pay again. Resolve those cases fairly; a no-refund notice does not fix
  this race. A pre-payment expiring-hold workflow is separate work.
- Unchanged retry protection is per open page, not durable across refresh/devices.
  After an uncertain network result, contact staff before paying/submitting again.
- No automatic release of unpaid bookings is implemented. Admins must cancel them;
  do not promise automatic expiry. No automated receipt retention or API gateway
  rate limiting is provided. CAPTCHA is not protection against all abuse.
- Monitor Supabase errors/quotas, keep backups, and perform staging concurrency
  tests. No software change is an absolute security or uptime guarantee.
