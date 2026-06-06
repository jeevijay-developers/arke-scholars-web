import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is staff/admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
      admin.rpc("has_role", { _user_id: callerId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: callerId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const applicationId: string | undefined = body?.application_id;
    const password: string | undefined = body?.password;

    if (!applicationId || !password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "application_id and password (min 8 chars) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: app, error: appErr } = await admin
      .from("educator_applications")
      .select("id, email, candidate_name, contact_no")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = app.email.toLowerCase().trim();

    // Find or create user — perPage:1000 matches manage-admin (default 50 misses users; V12)
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    let user = existing?.users.find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: app.candidate_name,
          phone: app.contact_no,
        },
        app_metadata: { must_change_password: true },
      });
      if (createErr) throw createErr;
      user = created.user!;
    } else {
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        app_metadata: {
          ...(user.app_metadata ?? {}),
          must_change_password: true,
        },
      });
      if (updErr) throw updErr;
    }

    // Assign teacher role
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "teacher" },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw roleErr;

    // Upsert profile
    await admin
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: app.candidate_name,
          phone: app.contact_no,
        },
        { onConflict: "user_id" },
      );

    // Mark application as credentials_sent
    await admin
      .from("educator_applications")
      .update({
        status: "credentials_sent",
        credentials_sent_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        email,
        password,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
