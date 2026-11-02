import { createClient } from "npm:@supabase/supabase-js@2";
import { sendBookingEmails } from "../_shared/booking-email.ts";
// Deploy --no-verify-jwt; validate the actual signed user below (not browser metadata).
Deno.serve(async (req: Request) => {
  const origin = Deno.env.get("BOOKING_ORIGIN") || "";
  const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const reply = (status: number) => Response.json({ok:status===200}, {status,headers});
  if (!origin || req.headers.get("origin") !== origin) return reply(403);
  if (req.method === "OPTIONS") return new Response(null,{headers});
  if (req.method !== "POST") return reply(405);
  try {
    const auth = req.headers.get("authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {global:{headers:{Authorization:auth}}});
    const {data,error} = await client.auth.getUser();
    if (error || !data.user) return reply(401);
    const access = await client.rpc("is_dnd_admin");
    if (access.error || access.data !== true) return reply(403);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sendBookingEmails(db,null);
    return reply(200);
  } catch { return reply(503); }
});
