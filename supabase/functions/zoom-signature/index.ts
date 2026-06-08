import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meetingNumber, classSlug } = await req.json() as {
      meetingNumber: string;
      classSlug: string;
    };

    if (!meetingNumber || !classSlug) {
      return new Response(JSON.stringify({ error: "meetingNumber and classSlug are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sdkKey = Deno.env.get("ZOOM_SDK_KEY");
    const sdkSecret = Deno.env.get("ZOOM_SDK_SECRET");
    if (!sdkKey || !sdkSecret) {
      return new Response(JSON.stringify({ error: "Zoom SDK credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive role server-side — never trust client
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: liveClass } = await svcClient
      .from("live_classes")
      .select("created_by")
      .eq("slug", classSlug)
      .maybeSingle();

    if (!liveClass) {
      return new Response(JSON.stringify({ error: "Live class not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1 = host (teacher/creator), 0 = attendee
    const role = liveClass.created_by === user.id ? 1 : 0;

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7200;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sdkSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await create(
      { alg: "HS256", typ: "JWT" },
      {
        sdkKey,
        mn: meetingNumber.replace(/\D/g, ""),
        role,
        iat: now - 30,
        exp,
        tokenExp: exp,
      },
      key,
    );

    return new Response(JSON.stringify({ signature, sdkKey, role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
