import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const AGORA_API_BASE = "https://api.agora.io/v1/apps";

interface StartRequest {
  action: "start";
  channelName: string;
  classId: string;
  uid: string;
}

interface StopRequest {
  action: "stop";
  channelName: string;
  classId: string;
  resourceId: string;
  sid: string;
  uid: string;
}

type Request = StartRequest | StopRequest;

function getBasicAuthHeader(customerId: string, customerSecret: string): string {
  return "Basic " + btoa(`${customerId}:${customerSecret}`);
}

async function acquireResource(
  appId: string,
  channelName: string,
  uid: string,
  authHeader: string,
): Promise<{ resourceId: string; sid: string } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/acquire`;
  const body = {
    cname: channelName,
    uid: uid,
    clientRequest: {},
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Acquire] HTTP ${res.status}: ${err}`);
      return null;
    }

    const data = await res.json() as { resourceId?: string; sid?: string };
    if (!data.resourceId) {
      console.error("[Acquire] No resourceId in response", data);
      return null;
    }

    return { resourceId: data.resourceId, sid: data.sid || "" };
  } catch (e) {
    console.error("[Acquire] Error:", e);
    return null;
  }
}

async function startRecording(
  appId: string,
  channelName: string,
  uid: string,
  resourceId: string,
  authHeader: string,
  bucket: string,
  accessKey: string,
  secretKey: string,
  endpoint: string,
): Promise<{ sid: string } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
  const body = {
    cname: channelName,
    uid: uid,
    clientRequest: {
      recordingConfig: {
        maxIdleTime: 30,
        streamTypes: 2,
        audioProfile: 1,
        channelType: 1,
        videoStreamType: 0,
        transcodingConfig: {
          height: 720,
          width: 1280,
          bitrate: 2500,
          fps: 15,
          mixedAudioBitrate: 128,
        },
      },
      recordingFileConfig: {
        avFileType: ["m3u8", "mp4"],
      },
      storageConfig: {
        vendor: 1,
        region: 0,
        bucket: bucket,
        accessKey: accessKey,
        secretKey: secretKey,
        endpoint: endpoint,
        fileNamePrefix: ["arke", "live-class"],
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Start] HTTP ${res.status}: ${err}`);
      return null;
    }

    const data = await res.json() as { sid?: string };
    if (!data.sid) {
      console.error("[Start] No sid in response", data);
      return null;
    }

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
  uid: string,
  authHeader: string,
): Promise<{ fileList?: Array<{ filename: string }> } | null> {
  const url = `${AGORA_API_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/sid/${sid}/stop`;
  const body = {
    cname: channelName,
    uid: uid,
    clientRequest: {},
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Stop] HTTP ${res.status}: ${err}`);
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
    const { action, channelName, classId, uid } = body;

    const appId = Deno.env.get("AGORA_APP_ID");
    const customerId = Deno.env.get("AGORA_CUSTOMER_ID");
    const customerSecret = Deno.env.get("AGORA_CUSTOMER_SECRET");

    if (!appId || !customerId || !customerSecret) {
      return new Response(
        JSON.stringify({ error: "Agora credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = getBasicAuthHeader(customerId, customerSecret);

    if (action === "start") {
      const bucket = Deno.env.get("AGORA_RECORDING_BUCKET");
      const accessKey = Deno.env.get("AGORA_RECORDING_S3_ACCESS_KEY");
      const secretKey = Deno.env.get("AGORA_RECORDING_S3_SECRET_KEY");
      const endpoint = Deno.env.get("AGORA_RECORDING_S3_ENDPOINT");
      const region = Deno.env.get("AGORA_RECORDING_S3_REGION") || "us-east-1";

      if (!bucket || !accessKey || !secretKey || !endpoint) {
        return new Response(
          JSON.stringify({ error: "S3 storage config not set" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 1: Acquire resource
      const acquired = await acquireResource(appId, channelName, uid, authHeader);
      if (!acquired) {
        return new Response(
          JSON.stringify({ error: "Failed to acquire resource" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 2: Start recording
      const started = await startRecording(
        appId,
        channelName,
        uid,
        acquired.resourceId,
        authHeader,
        bucket,
        accessKey,
        secretKey,
        endpoint,
      );

      console.log(`[Recording] Started with resourceId=${acquired.resourceId}, sid=${started?.sid}`);

      if (!started) {
        return new Response(
          JSON.stringify({ error: "Failed to start recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          resourceId: acquired.resourceId,
          sid: started.sid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (action === "stop") {
      const stopReq = body as StopRequest;
      const { resourceId, sid } = stopReq;

      // Step 1: Stop recording
      const stopped = await stopRecording(appId, resourceId, sid, channelName, uid, authHeader);
      if (!stopped) {
        return new Response(
          JSON.stringify({ error: "Failed to stop recording" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Step 2: Extract recording URL from fileList
      let recordingUrl = "";
      if (stopped.fileList && stopped.fileList.length > 0) {
        // Find the first .m3u8 file (HLS playlist)
        const m3u8File = stopped.fileList.find((f) => f.filename.endsWith(".m3u8"));
        if (m3u8File) {
          const bucket = Deno.env.get("AGORA_RECORDING_BUCKET");
          const endpoint = Deno.env.get("AGORA_RECORDING_S3_ENDPOINT");
          // Construct the public URL
          recordingUrl = `${endpoint}/${bucket}/arke/live-class/${m3u8File.filename}`;
        }
      }

      // Step 3: Update live_classes with recording_url
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseKey && recordingUrl) {
        const { error } = await fetch(`${supabaseUrl}/rest/v1/live_classes`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ recording_url: recordingUrl }),
        }).then((r) => r.json() as Promise<{ error?: { message: string } }>);

        if (error) {
          console.error("[DB Update] Error:", error);
          // Still return success since recording was stopped; DB update is best-effort
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          fileList: stopped.fileList,
          recordingUrl,
        }),
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
