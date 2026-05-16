import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Reassigns the mentor1@arke.pro mentor to the pre-existing real students
 * (Lakshay, Zaid, Fatima, Pawan) and removes the three demo mentees that
 * were seeded earlier (mentee1/2/3@arke.pro).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const users = list?.users ?? [];

    const mentor = users.find((u) => u.email?.toLowerCase() === "mentor1@arke.pro");
    if (!mentor) throw new Error("mentor1@arke.pro not found");

    // 1. Remove demo mentees + their data
    const demoEmails = ["mentee1@arke.pro", "mentee2@arke.pro", "mentee3@arke.pro"];
    const demoIds = users.filter((u) => demoEmails.includes(u.email?.toLowerCase() ?? "")).map((u) => u.id);

    for (const sid of demoIds) {
      await admin.from("mentor_group_members").delete().eq("student_id", sid);
      await admin.from("mentor_student_assignments").delete().eq("student_id", sid);
      await admin.from("user_roles").delete().eq("user_id", sid);
      await admin.from("profiles").delete().eq("user_id", sid);
      await admin.auth.admin.deleteUser(sid);
    }

    // 2. Identify pre-existing students:
    //    everyone with a profile who is NOT admin/super_admin/teacher/mentor.
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const staffSet = new Set(
      (roles ?? [])
        .filter((r) => ["admin", "super_admin", "teacher", "mentor"].includes(r.role))
        .map((r) => r.user_id),
    );

    const { data: profiles } = await admin.from("profiles").select("user_id, full_name");
    const preStudents = (profiles ?? []).filter((p) => !staffSet.has(p.user_id));

    // 3. Ensure they have a 'student' role + assign to mentor
    const assigned: { id: string; name: string | null }[] = [];
    for (const p of preStudents) {
      await admin
        .from("user_roles")
        .upsert({ user_id: p.user_id, role: "student" }, { onConflict: "user_id,role" });

      const { data: existing } = await admin
        .from("mentor_student_assignments")
        .select("id, removed_at")
        .eq("mentor_id", mentor.id)
        .eq("student_id", p.user_id)
        .maybeSingle();

      if (!existing) {
        await admin.from("mentor_student_assignments").insert({
          mentor_id: mentor.id,
          student_id: p.user_id,
          assigned_by: mentor.id,
        });
      } else if (existing.removed_at) {
        await admin
          .from("mentor_student_assignments")
          .update({ removed_at: null })
          .eq("id", existing.id);
      }
      assigned.push({ id: p.user_id, name: p.full_name });
    }

    return new Response(
      JSON.stringify({ success: true, removed: demoIds, assigned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
