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
    { method: "POST", headers: { Authorization: `Basic ${credentials}` } },
  );
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// Returns existing zoom_user_id or provisions a new Zoom user and saves it
async function ensureZoomUser(
  svcClient: ReturnType<typeof createClient>,
  teacherId: string,
  accessToken: string,
): Promise<string> {
  // Check if already provisioned
  const { data: profile } = await svcClient
    .from("profiles")
    .select("zoom_user_id, full_name, email:user_id")
    .eq("user_id", teacherId)
    .maybeSingle();

  if (profile?.zoom_user_id) return profile.zoom_user_id;

  // Get the teacher's email from auth.users
  const { data: authUser } = await svcClient.auth.admin.getUserById(teacherId);
  const email = authUser?.user?.email;
  if (!email) throw new Error("Teacher email not found");

  // Check if this email already exists in Zoom (e.g. they signed up themselves)
  const checkRes = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let zoomUserId: string;

  if (checkRes.ok) {
    const existing = await checkRes.json() as { id: string };
    zoomUserId = existing.id;
  } else {
    // Create new Zoom user (custCreate = no email invite, no Zoom account required)
    const createRes = await fetch("https://api.zoom.us/v2/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "custCreate",
        user_info: {
          email,
          type: 1, // Basic user (upgrade to Licensed if your plan allows)
          display_name: profile?.full_name || email.split("@")[0],
        },
      }),
    });
    if (!createRes.ok) throw new Error(`Zoom user creation failed: ${await createRes.text()}`);
    const created = await createRes.json() as { id: string };
    zoomUserId = created.id;
  }

  // Persist so we don't provision again next time
  await svcClient.from("profiles").update({ zoom_user_id: zoomUserId }).eq("user_id", teacherId);

  return zoomUserId;
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

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only admin / super_admin / teacher may create meetings
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

    const { title, startTime, durationMinutes = 60, teacherId } = await req.json() as {
      title: string;
      startTime: string;
      durationMinutes?: number;
      teacherId?: string; // Arke user_id of the teacher hosting the class
    };

    if (!title || !startTime) {
      return new Response(JSON.stringify({ error: "title and startTime are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getZoomAccessToken();

    // Resolve which Zoom user hosts this meeting
    // Falls back to "me" (account owner) if no teacherId provided
    let hostUserId = "me";
    if (teacherId) {
      try {
        hostUserId = await ensureZoomUser(svcClient, teacherId, accessToken);
      } catch (e) {
        console.warn("[zoom-create-meeting] Could not provision Zoom user, falling back to me:", e);
        hostUserId = "me";
      }
    }

    const meetingRes = await fetch(`https://api.zoom.us/v2/users/${hostUserId}/meetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: title,
        type: 2, // scheduled
        start_time: startTime,
        duration: durationMinutes,
        settings: {
          host_video: true,
          participant_video: true,
          waiting_room: false,
          auto_recording: "none",
          join_before_host: false,
          mute_upon_entry: true,
        },
      }),
    });

    if (!meetingRes.ok) {
      throw new Error(`Zoom meeting creation failed: ${await meetingRes.text()}`);
    }

    const meeting = await meetingRes.json() as { id: number; password: string; join_url: string };

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
