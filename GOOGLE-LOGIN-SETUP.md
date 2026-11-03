# Google team login — setup required

Approved accounts: lopezeden1101@gmail.com and dcchamie25@gmail.com.
There is no SMS charge for this login flow. Supabase and Google quotas/terms still apply.
These addresses are identifiers, not passwords. Do not share Google passwords or codes.

## 1. Apply database security first
In Supabase → SQL Editor, run:
`supabase/migrations/202611020003_google_admin_access.sql`.
If the payment receipt migration has not been applied, run that first.
Fresh projects can run schema.sql instead (do not re-run the whole schema over
customized settings, as its settings seed resets existing values).

The database checks both a Google-issued Supabase session and the verified email
on the Supabase user record. Other accounts and email/password sessions cannot
read or change bookings, change settings, or read private receipt images.
Public settings and availability remain readable to customers.

This replaces the repository's existing broad authenticated-owner policies.
If you created additional custom policies granting authenticated users access,
review/remove those: PostgreSQL permissive policies are combined with OR.
Sign out old owner sessions and sign in with Google after applying the migration.

## 2. Google configuration
1. Open Google Cloud Console. Select/create a project for the business.
2. Open Google Auth Platform (or APIs & Services → OAuth consent screen).
3. Configure Branding (app name, support email, contact email) and Audience.
   Choose External if using personal Gmail accounts. While in Testing, add both
   approved Gmail addresses as test users. Google may require re-login more often
   for testing apps. Only request basic sign-in scopes (openid, email, profile).
4. Under Clients/Credentials, create an OAuth client of type Web application.
5. Add the authorized redirect URI copied from Supabase's Google provider panel:
   `https://wryrseqayqvmorgpjqx.supabase.co/auth/v1/callback`
   If using a different Supabase project, copy that project's URI instead.
6. Copy Client ID and Client Secret into Supabase's Google provider configuration.
   The secret goes ONLY in Supabase, never GitHub, config.js or chat.

## 3. Supabase configuration
1. Authentication → Sign In / Providers → Google: enable it, enter Client ID and
   Client Secret, save. Leave nonce/email-verification security protections on.
2. Authentication → URL Configuration: set Site URL to your production website
   origin. Add your exact `https://YOUR-DOMAIN/dinteams/login` to Redirect URLs.
   Add a specific preview URL only when you need to test; avoid broad wildcards.
3. Keep new-user signup enabled for the initial Google logins (otherwise create
   the users through an appropriate managed flow). Unlike the original app,
   new signups alone do NOT grant owner access: the database allowlist does.
4. Fill only the Supabase anon/publishable key in config.js if still blank.
5. Deploy the working branch after the migration is applied. Live login uses
   Google only. Demo mode (blank Supabase key) continues to use PIN 1234 and
   browser-local demo data, never real owner data.

## Test before merging/deploying production
1. Sign in with each approved Gmail: dashboard, reports and settings should open.
2. Sign in with an unrelated Google account: it should be signed out and denied.
3. With that unrelated session, direct database API reads/writes to bookings,
   settings writes, and private receipt reads must be denied. Settings reads and
   public availability remain public by design.
4. A former email/password session must be denied even if its email is approved.
5. Cancel Google sign-in and retry. Sign out from dashboard, then revisit a team
   page: it should send you to login. No password or SMS is requested by this site.

End-to-end OAuth testing needs the live URL, configured provider, keys and applied
migration; local code checks alone cannot prove that production setup works.
