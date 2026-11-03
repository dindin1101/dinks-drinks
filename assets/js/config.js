/*
 * ============================================================
 *  DINKS N DRINKS — BOOKING SYSTEM CONFIG
 * ============================================================
 *  -> ONLY ONE THING LEFT TO DO IN THIS FILE:
 *     Paste your Supabase anon / publishable key into
 *     SUPABASE_ANON_KEY below (keep the quotes " ").
 *
 *  Where to find the key:
 *    Supabase Dashboard -> your project -> Settings (gear)
 *      -> API Keys  ->  "Publishable key"  (starts with sb_publishable_)
 *         or if you see the older screen:  Settings -> API
 *         -> "anon / public"  (starts with eyJ...)
 *
 *  The URL below is already filled in with your project.
 *  The anon/publishable key is SAFE to be public (the security
 *  rules in supabase/schema.sql protect your data).
 *  NEVER paste the "service_role" / "secret" key here.
 *
 *  While the key is blank the site runs in DEMO MODE
 *  (bookings are saved only in the visitor's browser).
 * ============================================================
 */
window.DND_CONFIG = {
  SUPABASE_URL: "https://wryrseqayqvmorgpjqx.supabase.co",
  RECAPTCHA_SITE_KEY: "6LcYng0uAAAAAFgb_IP69yhjsSAV0_1-w9fYbu39", /* Public reCAPTCHA v2 checkbox site key; never the secret. */
  SUPABASE_ANON_KEY: ""   /* <-- PASTE YOUR ANON / PUBLISHABLE KEY HERE */
};
