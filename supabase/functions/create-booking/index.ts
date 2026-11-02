// Deploy with --no-verify-jwt: this is a public endpoint protected by reCAPTCHA.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const origin = Deno.env.get("BOOKING_ORIGIN") || "";
  const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const reply = (status: number, error?: string) => Response.json(error ? { error } : { ok: true }, { status, headers });
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
    if (!result.success || result.hostname !== hostname) return reply(400, "Spam verification failed; complete the checkbox again");
    if (!b || typeof b.customer_name !== "string" || !b.customer_name.trim() || b.customer_name.length > 120 || !/^(09\d{9}|\+639\d{9})$/.test(b.mobile) || !/^DND-[A-Z0-9]+$/.test(b.booking_ref) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !["court", "openplay"].includes(b.booking_type) || !["gcash", "counter"].includes(b.payment_method) || !Array.isArray(b.slots) || b.slots.length > 100 || (b.notes && (typeof b.notes !== "string" || b.notes.length > 2000))) return reply(400, "Invalid booking details");
    // Explicit allowlist: never accept an incoming status, id or timestamp.
    const fields = ["booking_ref", "customer_name", "mobile", "booking_type", "date", "court_number", "start_hour", "end_hour", "slots", "pax", "rent_paddle", "paddle_qty", "court_amount", "paddle_amount", "total_amount", "payment_method", "gcash_ref", "notes"];
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
    if (error) return reply(400, "Could not save booking");
    return reply(200);
  } catch {
    return reply(400, "Could not process booking; please try again");
  }
});
