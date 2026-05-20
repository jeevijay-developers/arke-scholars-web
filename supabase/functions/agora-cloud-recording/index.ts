import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const AGORA_API_BASE = "https://api.agora.io/v1/apps";

// Fixed uint32 UID for the recording bot — must not collide with real users
const RECORDING_BOT_UID = 999999;

// ---------- Minimal Agora RTC token builder (v007) ----------
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
async function buildBotToken(appId: string, cert: string, channel: string): Promise<string> {
  const now   = Math.floor(Date.now() / 1000);
  const salt  = Math.floor(Math.random() * 0xffffffff);
  const expiry = now + 3600;

  const privileges = new Map<number, number>();
  privileges.set(1, expiry); // join channel
  privileges.set(2, expiry); // subscribe audio
  privileges.set(3, expiry); // subscribe video

  const msgBytes = new Uint8Array([
    ...packUint32(1),
    ...packUint32(salt),
    ...packUint32(now),
    ...packUint32(expiry),
    ...packString(channel),
    ...packString(String(RECORDING_BOT_UID)),
    ...packMap(privileges),
  ]);

  const certBytes = new TextEncoder().encode(cert);
  const toSign    = new TextEncoder().encode(appId + String(now) + String(salt));
  const signingKey = await hmac256(certBytes, toSign);
  const sig        = await hmac256(signingKey, msgBytes);
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
// ------------------------------------------------------------

interface StartRequest {
  action: "start";
  channelName: string;
  classId: string;
}

interface StopRequest {
  action: "stop";
  channelName: string;
  classId: string;
  resourceId: string;
  sid: string;
}

type Request = StartRequest | StopRequest;

function getBasicAuthHeader(customerId: string, customerSecret: string): string {
  return "Basic " + btoa(`${customerId}:${customerSecret}`);
}

async function acquireResource(
  appId: string,
  channelName: string,
  authHeader: string,
): Promise<{ resourceId: string } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/acquire`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        cname: channelName,
        uid: String(RECORDING_BOT_UID),
        clientRequest: {},
      }),
    });
    if (!res.ok) {
      console.error(`[Acquire] HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json() as { resourceId?: string };
    if (!data.resourceId) { console.error("[Acquire] No resourceId", data); return null; }
    return { resourceId: data.resourceId };
  } catch (e) {
    console.error("[Acquire] Error:", e);
    return null;
  }
}

async function startRecording(
  appId: string,
  channelName: string,
  resourceId: string,
  token: string | null,
  authHeader: string,
  bucket: string,
  accessKey: string,
  secretKey: string,
  endpoint: string,
): Promise<{ sid: string } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
  const clientRequest: Record<string, unknown> = {
    recordingConfig: {
      maxIdleTime: 30,
      streamTypes: 2,
      audioProfile: 1,
      channelType: 1,
      videoStreamType: 0,
      transcodingConfig: { height: 720, width: 1280, bitrate: 2500, fps: 15, mixedAudioBitrate: 128 },
    },
    recordingFileConfig: { avFileType: ["m3u8", "mp4"] },
    storageConfig: {
      vendor: 1,
      region: 0,
      bucket,
      accessKey,
      secretKey,
      endpoint,
      fileNamePrefix: ["arke", "live-class"],
    },
  };
  if (token) clientRequest.token = token;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ cname: channelName, uid: String(RECORDING_BOT_UID), clientRequest }),
    });
    if (!res.ok) {
      console.error(`[Start] HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json() as { sid?: string };
    if (!data.sid) { console.error("[Start] No sid", data); return null; }
    return { sid: data.sid };
  } catch (e) {
    console.error("[Start] Error:", e);
    return null;
  }
}

async function stopRecording(
  appId: string,
  resourceId: string,
  sid: string,
  channelName: string,
  authHeader: string,
): Promise<{ fileList?: Array<{ filename: string }> } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/sid/${sid}/stop`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ cname: channelName, uid: String(RECORDING_BOT_UID), clientRequest: {} }),
    });
    if (!res.ok) {
      console.error(`[Stop] HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    return await res.json() as { fileList?: Array<{ filename: string }> };
  } catch (e) {
    console.error("[Stop] Error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as Request;
    const { action, channelName, classId } = body;

    const appId          = Deno.env.get("AGORA_APP_ID");
    const appCert        = Deno.env.get("AGORA_APP_CERTIFICATE");
    const customerId     = Deno.env.get("AGORA_CUSTOMER_ID");
    const customerSecret = Deno.env.get("AGORA_CUSTOMER_SECRET");

    if (!appId || !customerId || !customerSecret) {
      return new Response(
        JSON.stringify({ error: "Agora credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = getBasicAuthHeader(customerId, customerSecret);

    if (action === "start") {
      const bucket    = Deno.env.get("AGORA_RECORDING_BUCKET");
      const accessKey = Deno.env.get("AGORA_RECORDING_S3_ACCESS_KEY");
      const secretKey = Deno.env.get("AGORA_RECORDING_S3_SECRET_KEY");
      const endpoint  = Deno.env.get("AGORA_RECORDING_S3_ENDPOINT");

      if (!bucket || !accessKey || !secretKey || !endpoint) {
        return new Response(
          JSON.stringify({ error: "S3 storage config not set" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const acquired = await acquireResource(appId, channelName, authHeader);
      if (!acquired) {
        return new Response(
          JSON.stringify({ error: "Failed to acquire resource" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Generate a token for the recording bot so it can join a token-secured channel
      let botToken: string | null = null;
      if (appCert) {
        botToken = await buildBotToken(appId, appCert, channelName);
      }

      const started = await startRecording(
        appId, channelName, acquired.resourceId, botToken,
        authHeader, bucket, accessKey, secretKey, endpoint,
      );

      if (!started) {
        return new Response(
          JSON.stringify({ error: "Failed to start recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.log(`[Recording] Started resourceId=${acquired.resourceId} sid=${started.sid}`);
      return new Response(
        JSON.stringify({ success: true, resourceId: acquired.resourceId, sid: started.sid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "stop") {
      const { resourceId, sid } = body as StopRequest;

      const stopped = await stopRecording(appId, resourceId, sid, channelName, authHeader);
      if (!stopped) {
        return new Response(
          JSON.stringify({ error: "Failed to stop recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Agora fileList filenames already include the fileNamePrefix path
      let recordingUrl = "";
      if (stopped.fileList?.length) {
        const m3u8File = stopped.fileList.find((f) => f.filename.endsWith(".m3u8"));
        if (m3u8File) {
          const bucket   = Deno.env.get("AGORA_RECORDING_BUCKET");
          const endpoint = Deno.env.get("AGORA_RECORDING_S3_ENDPOINT");
          recordingUrl = `${endpoint}/${bucket}/${m3u8File.filename}`;
        }
      }

      // Update only the matching live_classes row — classId filter is required
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseKey && recordingUrl && classId) {
        const patchRes = await fetch(
          `${supabaseUrl}/rest/v1/live_classes?id=eq.${classId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ recording_url: recordingUrl }),
          },
        );
        if (!patchRes.ok) {
          console.error("[DB Update] Error:", await patchRes.text());
        }
      }

      return new Response(
        JSON.stringify({ success: true, fileList: stopped.fileList, recordingUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[Error]", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
