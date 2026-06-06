import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-token@2.0.4";

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
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // role is NOT accepted from the client — derived server-side from class ownership/enrollment
    const { channelName, uid } = await req.json();
    if (!channelName) {
      return new Response(JSON.stringify({ error: "channelName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: "Agora credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive Agora role from DB: class creator → PUBLISHER, enrolled/staff → SUBSCRIBER
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: liveClass } = await svcClient
      .from("live_classes")
      .select("id, course_id, created_by")
      .eq("slug", channelName)
      .maybeSingle();

    if (!liveClass) {
      return new Response(JSON.stringify({ error: "Live class not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let agoraRole: number;
    if (liveClass.created_by === user.id) {
      agoraRole = RtcRole.PUBLISHER;
    } else {
      // For course-linked classes, verify active enrollment (not expired)
      if (liveClass.course_id) {
        const { data: enrollment } = await svcClient
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", liveClass.course_id)
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .maybeSingle();

        if (!enrollment) {
          const [{ data: isAdmin }, { data: isSuper }, { data: isTeacher }] = await Promise.all([
            svcClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
            svcClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
            svcClient.rpc("has_role", { _user_id: user.id, _role: "teacher" }),
          ]);
          if (!isAdmin && !isSuper && !isTeacher) {
            return new Response(JSON.stringify({ error: "Enrollment required to join this class" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
      agoraRole = RtcRole.SUBSCRIBER;
    }

    const expireTs = Math.floor(Date.now() / 1000) + 3600;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId, appCertificate, channelName, uid ?? 0, agoraRole, expireTs, expireTs
    );

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
