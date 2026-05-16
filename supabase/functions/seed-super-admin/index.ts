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

    const EMAIL = "superadmin@arke.pro";
    const PASSWORD = "arke@123";

    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let user = existingUsers?.users.find((u) => u.email === EMAIL);

    if (!user) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: EMAIL,
          password: PASSWORD,
          email_confirm: true,
        });
      if (createErr) throw createErr;
      user = created.user!;
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password: PASSWORD,
        email_confirm: true,
      });
    }

    // Replace any existing roles with super_admin
    await admin.from("user_roles").delete().eq("user_id", user.id);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, role: "super_admin" });
    if (roleErr) throw roleErr;

    // Ensure a profile exists
    await admin
      .from("profiles")
      .upsert(
        { user_id: user.id, full_name: "Super Admin" },
        { onConflict: "user_id" },
      );

    return new Response(
      JSON.stringify({ success: true, user_id: user.id, email: EMAIL }),
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
