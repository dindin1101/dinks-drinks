import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Never called with a browser-supplied recipient or message: jobs come from SQL.
export async function sendBookingEmails(db: SupabaseClient, ref: string | null): Promise<void> {
  const secret = Deno.env.get("BOOKING_EMAIL_SECRET");
  const url = Deno.env.get("BOOKING_EMAIL_URL");
  if (!secret || !url || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return;
  const { data: jobs, error } = await db.rpc("claim_booking_emails", { p_ref: ref });
  if (error || !jobs) return;
  for (const job of jobs) {
    let state = job.attempts >= 5 ? "failed" : "pending";
    try {
      const payload = JSON.stringify({ ...job.payload, id: job.id, total: Number(job.payload.total) });
      const timestamp = Date.now();
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + payload))), b => b.toString(16).padStart(2,"0")).join("");
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp, payload, signature }), redirect: "follow",
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (response.ok && result.ok === true) state = "sent";
      else if (["uncertain", "send_failed", "invalid", "unauthorized"].includes(result.error)) state = "failed";
    } catch {
      // Retrying uses the SAME event ID, so Apps Script can suppress duplicates.
    }
    await db.from("booking_email_outbox").update({ state, available_at: new Date(Date.now()+300000).toISOString() }).eq("id",job.id);
  }
}
