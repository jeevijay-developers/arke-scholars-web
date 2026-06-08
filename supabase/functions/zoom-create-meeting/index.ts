import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID")!;
  const clientId = Deno.env.get("ZOOM_CLIENT_ID")!;
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET")!;

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth failed: ${body}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

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

    // Only admin / super_admin / teacher can create meetings
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: isAdmin }, { data: isSuper }, { data: isTeacher }] = await Promise.all([
      svcClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      svcClient.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
      svcClient.rpc("has_role", { _user_id: user.id, _role: "teacher" }),
    ]);

    if (!isAdmin && !isSuper && !isTeacher) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, startTime, durationMinutes = 60 } = await req.json() as {
      title: string;
      startTime: string;
      durationMinutes?: number;
    };

    if (!title || !startTime) {
      return new Response(JSON.stringify({ error: "title and startTime are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getZoomAccessToken();

    const meetingRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: title,
        type: 2, // scheduled meeting
        start_time: startTime,
        duration: durationMinutes,
        settings: {
          host_video: true,
          participant_video: true,
          waiting_room: false,
          auto_recording: "none",
          join_before_host: false,
        },
      }),
    });

    if (!meetingRes.ok) {
      const body = await meetingRes.text();
      throw new Error(`Zoom meeting creation failed: ${body}`);
    }

    const meeting = await meetingRes.json() as {
      id: number;
      password: string;
      join_url: string;
    };

    return new Response(
      JSON.stringify({
        meetingId: String(meeting.id),
        password: meeting.password,
        joinUrl: meeting.join_url,
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
