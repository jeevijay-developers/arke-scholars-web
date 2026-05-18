/**
 * Agora RTC Token Generator — Supabase Edge Function
 *
 * POST /functions/v1/agora-token
 * Body: { channelName: string, uid?: number, role?: "host" | "audience" }
 * Returns: { token: string | null }
 *
 * Set these Supabase secrets for production:
 *   supabase secrets set AGORA_APP_ID=xxx AGORA_APP_CERTIFICATE=yyy
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Agora RtcTokenBuilder v007 (Deno-compatible) ----------

const ROLE_PUBLISHER  = 1;
const ROLE_SUBSCRIBER = 2;

function packUint16(v: number): number[] {
  return [(v >> 8) & 0xff, v & 0xff];
}
function packUint32(v: number): number[] {
  return [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
function packString(s: string): number[] {
  const b = new TextEncoder().encode(s);
  return [...packUint16(b.length), ...b];
}
function packMap(m: Map<number, number>): number[] {
  const out: number[] = [...packUint16(m.size)];
  for (const [k, v] of m) out.push(...packUint16(k), ...packUint32(v));
  return out;
}

async function hmac256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function buildToken(
  appId: string, cert: string, channel: string,
  uid: number, role: number, expiry: number,
): Promise<string> {
  const now   = Math.floor(Date.now() / 1000);
  const salt  = Math.floor(Math.random() * 0xffffffff);
  const uidStr = uid === 0 ? "" : String(uid);

  const privileges = new Map<number, number>();
  privileges.set(1, expiry); // join channel
  if (role === ROLE_PUBLISHER) {
    privileges.set(2, expiry); // publish audio
    privileges.set(3, expiry); // publish video
    privileges.set(4, expiry); // publish data
  }

  const msgBytes = new Uint8Array([
    ...packUint32(1), // message type
    ...packUint32(salt),
    ...packUint32(now),
    ...packUint32(expiry),
    ...packString(channel),
    ...packString(uidStr),
    ...packMap(privileges),
  ]);

  const certBytes = new TextEncoder().encode(cert);
  const toSign = new TextEncoder().encode(appId + String(now) + String(salt));
  const signingKey = await hmac256(certBytes, toSign);
  const sig = await hmac256(signingKey, msgBytes);

  const appIdBytes = new TextEncoder().encode(appId);
  const content = new Uint8Array([
    ...packUint16(sig.length), ...sig,
    ...packUint16(appIdBytes.length), ...appIdBytes,
    ...packUint32(now),
    ...packUint32(salt),
    ...packUint16(msgBytes.length), ...msgBytes,
  ]);

  return "007" + btoa(String.fromCharCode(...content));
}

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const appId = Deno.env.get("AGORA_APP_ID");
    const cert  = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!appId) {
      return new Response(JSON.stringify({ error: "AGORA_APP_ID secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cert) {
      // No certificate — testing mode
      return new Response(JSON.stringify({ token: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { channelName, uid = 0, role = "audience" } = body as {
      channelName?: string; uid?: number; role?: string;
    };

    if (!channelName) {
      return new Response(JSON.stringify({ error: "channelName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agoraRole = role === "host" ? ROLE_PUBLISHER : ROLE_SUBSCRIBER;
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const token = await buildToken(appId, cert, channelName, uid, agoraRole, expiry);

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
