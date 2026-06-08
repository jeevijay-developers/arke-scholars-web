import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretToken = Deno.env.get("ZOOM_WEBHOOK_SECRET_TOKEN");
    if (!secretToken) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const payload = JSON.parse(body) as {
      event: string;
      payload?: {
        object?: {
          id?: number;
          uuid?: string;
          recording_files?: Array<{ file_type: string; download_url: string }>;
          share_url?: string;
        };
      };
    };

    // Zoom URL validation challenge (sent when you first configure the webhook endpoint)
    if (payload.event === "endpoint.url_validation") {
      const challengePayload = payload as unknown as { payload: { plainToken: string } };
      const plainToken = challengePayload.payload.plainToken;
      const hash = createHmac("sha256", secretToken)
        .update(plainToken)
        .digest("hex");
      return new Response(
        JSON.stringify({ plainToken, encryptedToken: hash }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify Zoom's signature on all other events
    const timestamp = req.headers.get("x-zm-request-timestamp") ?? "";
    const zmSignature = req.headers.get("x-zm-signature") ?? "";
    const message = `v0:${timestamp}:${body}`;
    const expectedSig = "v0=" + createHmac("sha256", secretToken).update(message).digest("hex");

    if (expectedSig !== zmSignature) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle recording.completed — save share URL to live_classes
    if (payload.event === "recording.completed") {
      const obj = payload.payload?.object;
      const meetingId = String(obj?.id ?? "");
      const shareUrl = obj?.share_url ?? "";

      if (meetingId && shareUrl) {
        const svcClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        await svcClient
          .from("live_classes")
          .update({ recording_url: shareUrl })
          .eq("zoom_meeting_id", meetingId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
