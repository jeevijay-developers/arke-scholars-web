import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

    // Accept either classId (UUID) or classSlug for flexibility
    const body = await req.json() as { classId?: string; classSlug?: string };
    if (!body.classId && !body.classSlug) {
      return new Response(JSON.stringify({ error: "classId or classSlug is required" }), {
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

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const query = svcClient
      .from("live_classes")
      .select("created_by, zoom_meeting_id, zoom_meeting_password");

    const { data: liveClass } = body.classId
      ? await query.eq("id", body.classId).maybeSingle()
      : await query.eq("slug", body.classSlug!).maybeSingle();

    if (!liveClass?.zoom_meeting_id) {
      return new Response(JSON.stringify({ error: "Live class or Zoom meeting not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive role server-side — 1 = host, 0 = attendee
    let role = 0;
    if (liveClass.created_by === user.id) {
      role = 1;
    } else {
      // admin / super_admin / teacher also get host controls
      const [{ data: isAdmin }, { data: isSuper }, { data: isTeacher }] = await Promise.all([
        svcClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        svcClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
        svcClient.rpc("has_role", { _user_id: user.id, _role: "teacher" }),
      ]);
      if (isAdmin || isSuper || isTeacher) role = 1;
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 172800; // 48h — covers the longest possible class session
    const meetingNumber = liveClass.zoom_meeting_id.replace(/\D/g, "");

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sdkSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await create(
      { alg: "HS256", typ: "JWT" },
      // SDK v4+: use "appKey" instead of "sdkKey" in the JWT payload
      { appKey: sdkKey, mn: meetingNumber, role, iat: now - 30, exp, tokenExp: exp },
      key,
    );

    return new Response(
      JSON.stringify({
        signature,
        appKey: sdkKey,
        meetingNumber,
        password: liveClass.zoom_meeting_password ?? "",
        role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
