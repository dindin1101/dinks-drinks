// Deploy with --no-verify-jwt: this is a public endpoint protected by reCAPTCHA.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendBookingEmails } from "../_shared/booking-email.ts";

Deno.serve(async (req: Request) => {
  const origin = Deno.env.get("BOOKING_ORIGIN") || "";
  const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const reply = (status: number, error?: string, code?: string) => Response.json(error ? { error, code } : { ok: true }, { status, headers });
  if (!origin || req.headers.get("origin") !== origin) return reply(403, "Origin not allowed");
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply(405, "Method not allowed");
  try {
    const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");
    const hostname = Deno.env.get("RECAPTCHA_HOSTNAME");
    if (!secret || !hostname) return reply(503, "Spam protection is not configured");
    const text = await req.text();
    if (text.length > 1500000) return reply(413, "Request too large");
    const { booking: b, protection: p, proof } = JSON.parse(text);
    if (!p || p.website !== "" || typeof p.token !== "string" || !p.token || p.token.length > 4096) return reply(400, "Spam check required");
    const verification = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST", body: new URLSearchParams({ secret, response: p.token }), signal: AbortSignal.timeout(10000)
    });
    if (!verification.ok) return reply(503, "Spam verification unavailable");
    const result = await verification.json();
    if (!result.success) {
      const codes: string[] = Array.isArray(result["error-codes"]) ? result["error-codes"] : [];
      // Never log tokens or secrets. These codes help the owner diagnose configuration.
      console.warn("Booking CAPTCHA rejected", { codes });
      if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) return reply(503, "Spam protection configuration needs attention. Please contact our team.", "CAPTCHA_CONFIG");
      if (codes.includes("timeout-or-duplicate")) return reply(400, "Spam check expired or was already used. Tick the checkbox again and retry.", "CAPTCHA_EXPIRED");
      return reply(400, "Spam verification failed. Complete the checkbox again. If it repeats, contact our team.", "CAPTCHA_REJECTED");
    }
    if (result.hostname !== hostname) {
      console.warn("Booking CAPTCHA hostname mismatch", { actual: result.hostname, expected: hostname });
      return reply(400, "Spam protection is not configured for this website address. Please contact our team.", "CAPTCHA_DOMAIN_MISMATCH");
    }
    if (!b || typeof b.customer_name !== "string" || !b.customer_name.trim() || b.customer_name.length > 120 || !/^(09\d{9}|\+639\d{9})$/.test(b.mobile) || !/^DND-[A-Z0-9]+$/.test(b.booking_ref) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !["court", "openplay"].includes(b.booking_type) || !["gcash", "counter"].includes(b.payment_method) || !Array.isArray(b.slots) || b.slots.length > 100 || (b.notes && (typeof b.notes !== "string" || b.notes.length > 2000))) return reply(400, "Invalid booking details");
    if (typeof b.customer_email !== "string" || b.customer_email.length > 254 || !/^[A-Za-z0-9._%+!\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(b.customer_email)) return reply(400, "Valid booking email required");
    if (typeof b.public_nickname !== "string" || b.public_nickname.trim().length < 2 || b.public_nickname.trim().length > 30 || /[\x00-\x1f\x7f]/.test(b.public_nickname)) return reply(400, "Public nickname required (2–30 characters)");
    function properName(value: string) {
      return value.trim().replace(/\s+/g, " ").toLocaleLowerCase().replace(/(^|[\s'-])([^\s'-])/g, (_, gap, letter) => gap + letter.toLocaleUpperCase());
    }
    b.customer_name = properName(b.customer_name);
    b.public_nickname = properName(b.public_nickname);
    b.customer_email = b.customer_email.trim().toLowerCase();
    // Explicit allowlist: never accept an incoming status, id or timestamp.
    const fields = ["booking_ref", "customer_email", "customer_name", "public_nickname", "mobile", "booking_type", "date", "court_number", "start_hour", "end_hour", "slots", "pax", "rent_paddle", "paddle_qty", "court_amount", "paddle_amount", "total_amount", "payment_method", "gcash_ref", "notes"];
    const row: Record<string, unknown> = { status: "pending" };
    for (const field of fields) row[field] = b[field];
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let proofPath: string | null = null;
    if (b.payment_method === "gcash") {
      if (!proof || !["image/jpeg", "image/png", "image/webp"].includes(proof.type) || typeof proof.data !== "string" || proof.data.length > 1398104) return reply(400, "Payment receipt required (maximum 1 MB)");
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(proof.data), c => c.charCodeAt(0)); }
      catch { return reply(400, "Invalid receipt"); }
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
      const webp = new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
      if (!bytes.length || bytes.length > 1048576 || !(proof.type === "image/jpeg" && jpeg || proof.type === "image/png" && png || proof.type === "image/webp" && webp)) return reply(400, "Invalid receipt image");
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[proof.type as string];
      proofPath = crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage.from("payment-proofs").upload(proofPath, bytes, { contentType: proof.type, upsert: false });
      if (uploadError) return reply(503, "Could not upload receipt");
      row.payment_proof_path = proofPath;
    }
    const { error } = await db.from("bookings").insert(row);
    if (error && proofPath) await db.storage.from("payment-proofs").remove([proofPath]);
    if (error) {
      if (error.message.includes("SLOT_UNAVAILABLE")) return reply(409, "That court slot was just booked. Choose another slot. If you already paid, contact us with your GCash reference before paying again.", "SLOT_UNAVAILABLE");
      if (error.message.includes("OPENPLAY_FULL")) return reply(409, "Open Play has just filled up. Choose another session. If you already paid, contact us with your GCash reference.", "OPENPLAY_FULL");
      if (error.message.includes("BOOKING_RATE_LIMIT")) return reply(429, "Too many recent bookings for this email or mobile. Please contact the team.", "BOOKING_RATE_LIMIT");
      if (error.message.includes("PRICE_CHANGED")) return reply(409, "Rates have changed. Refresh and review the total before continuing. If already paid, contact us first.", "PRICE_CHANGED");
      if (error.code === "23505") return reply(409, "This booking reference was already submitted. Contact the team with your reference before retrying or paying again.", "DUPLICATE_REFERENCE");
      return reply(400, "Booking details could not be accepted. Refresh and check your selection. If already paid, contact us before paying again.", "BOOKING_INVALID");
    }
    // Booking committed first; email is best-effort and may be retried from the outbox.
    EdgeRuntime.waitUntil(sendBookingEmails(db, b.booking_ref).catch(() => {}));
    return reply(200);
  } catch {
    return reply(400, "Could not process booking; please try again");
  }
});
