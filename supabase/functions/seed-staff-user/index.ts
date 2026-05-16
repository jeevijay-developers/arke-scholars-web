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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const STAFF_EMAIL = "rishabh@arke.in";
    const STAFF_PASSWORD = "rishabh@arke123";

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let user = existingUsers?.users.find((u) => u.email === STAFF_EMAIL);

    if (!user) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: STAFF_EMAIL,
          password: STAFF_PASSWORD,
          email_confirm: true,
        });
      if (createErr) throw createErr;
      user = created.user!;
    } else {
      // Ensure password is up-to-date and email confirmed
      await admin.auth.admin.updateUserById(user.id, {
        password: STAFF_PASSWORD,
        email_confirm: true,
      });
    }

    // Ensure admin role (formerly 'staff')
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ success: true, user_id: user.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
