# Game recording — planning only

UI only: /courts has a disabled Coming soon button; Booking has an informational
notice. No camera URL, request API, consent collection, storage upload, emails,
recording charge, retention automation or CCTV integration is implemented.
Do not enable the button until the actual workflow and privacy safeguards pass QA.

## Proposed private replay workflow (not implemented)
- Only a verified booking email recipient can request a booking's replay. A public
  nickname or public schedule alone is not authorization. Avoid leaking reference
  codes in public board URLs or exposing camera/NVR credentials in frontend code.
- Owner approves appropriate scope and player notice/consent arrangements before
  recording. Show only that court/time; never expose whole-site CCTV footage.
- NVR/service captures video; secure backend clips footage. Static HTML and
  Apps Script email sender do not capture/process CCTV video themselves.
- Store privately. Email an authenticated/expiring viewing link, not an attachment
  or a public anyone-with-link Drive share. Revoke access when retention ends.
- Owner proposes 48-hour retention. Define start as clip creation (or explicitly
  choose session end), show expiry, and document deletion of NVR originals as well
  as exported copies. Scheduling frequency determines actual deletion delay.
- Keep minimal non-video audit metadata if needed; never store public video URLs
  as booking notes or expose them through public RPCs.

## Storage choices
Private Google Drive is feasible for a small manual pilot, but website-authorized
access, per-booking permissions, capacity limits and automated cleanup still need
implementation. Normal Move to Trash is not permanent deletion: Drive trash can
retain files for up to 30 days. A true retention workflow must distinguish access
expiry, trashing and permanent deletion, as well as NVR originals/backups. Google
Drive is not an ideal general-purpose video streaming backend.

For automated replay: private object storage with lifecycle rules, an authenticated
video gateway and a compatible recording/export service is the more scalable
architecture. Costs depend on video bitrate, duration, number of courts, retention
and playback traffic. Do not promise zero cost or exact 48-hour deletion before
choosing and testing the backend. Avoid connecting cameras directly to the public
internet or forwarding camera ports.

Tapo suitability is model-specific. Confirm exact model, power source, local
recording/NVR compatibility, supported export/RTSP/ONVIF capabilities and terms
using official documentation before buying. A Tapo app playback feature by itself
does not prove automated website clip export is supported. Camera placement,
coverage and weather rating matter for court use. Do not request/share credentials.

## Booking failure during domain migration
The old generic error covers BOTH Google token rejection and verified-token
hostname mismatch. Screenshot alone cannot determine the cause. Latest Edge code
has safe diagnostic error codes and logs (no token/secret logging).
- Use https://dinksndrinks.vercel.app/booking, not the old alias.
- Save allowed domain in the existing v2 Checkbox registration; allow propagation.
- Keep RECAPTCHA_HOSTNAME=dinksndrinks.vercel.app and the corresponding original
  Google secret in RECAPTCHA_SECRET_KEY. Verify privately; never paste secret here.
- Fresh checkbox per submit; tokens can expire or be used only once.
- Redeploy updated create-booking with the existing helper import/JWT settings.
- If still failing, inspect function log error codes/hostname mismatch, not keys.
No successful real booking/payment/email E2E is confirmed yet.
