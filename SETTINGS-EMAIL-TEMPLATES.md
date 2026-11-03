# Home navigation, editable rates and booking email messages

## Owner controls
Open `/dinteams/settings` using an approved Google account.
- Rates: court per court-hour, Open Play per player, paddle per booking or per hour.
- Whole-peso amounts; court/Open Play must be positive, paddle may be zero.
- Email messages: separate pending, confirmed and cancelled text; shared footer.
- Preview is illustrative, plain text, and does not send email or create a booking.
- Save Settings applies to new page loads/new queued emails. Existing booking
  amounts and previously queued/sent emails are not rewritten.

Public Home links are now explicit on home/booking headers (including mobile).
Booking also includes Back to Home. Admin sidebars link separately to Home and
Booking page in the same tab.

## Existing installation: required one-time update
1. Run `supabase/migrations/202611030006_editable_email_messages.sql` in SQL Editor.
   This adds defaults without overwriting custom settings and updates the queue
   trigger to snapshot the chosen message/footer with every NEW email event.
   Do not re-run the whole schema over existing owner settings.
2. Replace the existing `doPost` handler in Apps Script with the current
   `integrations/google-apps-script/Code.gs`. Do not append a second doPost.
   You can replace the whole Code.gs file with that file: existing Script
   Properties are separate and remain saved. No need to rotate/change the key.
3. Apps Script: Deploy → Manage deployments → Edit → New version → Deploy.
   Keep Execute as Me (business Gmail), access Anyone, and existing /exec URL.
   The timestamped HMAC verification and duplicate suppression remain unchanged.
4. Deploy website changes. No Edge Function redeployment is required for this
   feature: the current shared helper already signs/forwards the full SQL payload.
   Fresh installations use schema.sql, which includes this migration.

Until steps 1–3 are done, the deployed old sender may still use its fixed text.
Changing settings alone cannot update an already deployed Apps Script handler.

## Email content
Sender: Dinks & Drinks <dinksdrinks.bookings@gmail.com>. Replies go to the
business Gmail. Subject stays fixed by booking status and reference.

Pending: received, not proof of verified payment.
Confirmed: confirmed schedule, with editable arrival instructions.
Cancelled: cancellation notice, NOT proof that a refund was processed.

Each email retains the reference, local date, court slots/session, total and
payment method, plus editable message/footer. No receipt links, mobile numbers,
private notes or passwords are included. Template editing is plain text, not HTML.
Mandatory payment/cancellation clarifications cannot be removed by text editing.
The updated sender has no hardcoded no-refund policy; site policy text elsewhere
is unchanged by this feature. Final refund policy remains an owner/legal decision.

## Checks
- Change court/paddle rates, save, reload Home and Booking; compare rates/totals.
- Toggle paddle pricing and verify homepage unit changes between hour/booking.
- Submit with stale totals: database should still reject the old amount.
- Edit each email message; preview should safely show it, not execute HTML.
- Make an OTC test booking: email retains schedule/reference plus new message.
- Change message after queueing: old queue keeps its original snapshot; future
  events use the new text. Sent emails cannot be edited retroactively.
- Confirm/cancel and check status-specific messages. Test signed/replayed events.

Local tests: tests/admin-settings.cjs, tests/booking-email.cjs,
tests/booking-safety.cjs (test-only PGlite dependency), tests/admin-google-only.cjs.
Actual mobile layout, Supabase policies and Gmail delivery need live testing.

## Branded HTML email update
The sender now includes inline, table-based HTML plus the original plain-text
fallback. Navy/cream/lime layout, status label, reference card, schedule and total,
fixed payment clarification and contact button. No remote image/font fetch is
required. Editable text remains escaped plain text, not injectable HTML.
`integrations/google-apps-script/email-preview.html` is a synthetic pending sample.
No previously sent email is modified by this update.

To activate email styling: replace Code.gs with the current repository file, save,
then Deploy → Manage deployments → Edit existing deployment → New version → Deploy.
Keep the same deployment URL, execution identity, access setting and Script Properties.
Do not paste keys into source. Styling itself needs no new keys or Edge redeploy;
editable messages still require migration006. Email-client rendering should be
checked in Gmail mobile/desktop and other supported clients after deployment.
