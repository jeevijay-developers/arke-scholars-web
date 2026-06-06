import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" });
    if (!isAdmin && !isSuper) return json(403, { error: "Only admins can manage students" });

    const body = await req.json();
    const action: string = body?.action;

    // Ensure target is a student: must have the student role and no privileged roles
    const ensureStudent = async (uid: string) => {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
      const set = new Set((roles ?? []).map((r) => r.role));
      if (set.has("super_admin") || set.has("admin") || set.has("teacher") || set.has("mentor")) return false;
      if (!set.has("student")) return false;
      return true;
    };

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "").trim();
      if (!email) return json(400, { error: "email required" });
      if (!password || password.length < 6) return json(400, { error: "password must be at least 6 characters" });

      // Create auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      const newUserId = created.user.id;

      // Upsert profile — plan and goal excluded (goal = target_exam, plan is dead)
      const profileData: Record<string, unknown> = { user_id: newUserId };
      for (const k of ["full_name", "phone", "target_exam", "class_level", "city", "country"]) {
        if (body?.[k] !== undefined && body[k] !== "") profileData[k] = body[k];
      }
      await admin.from("profiles").upsert(profileData, { onConflict: "user_id" });

      // Assign student role
      await admin.from("user_roles").upsert({ user_id: newUserId, role: "student" }, { onConflict: "user_id,role" });

      // Optional: enroll in a course
      if (body?.course_id) {
        const expiresAt = body?.expires_at ? new Date(body.expires_at).toISOString() : null;
        await admin.from("enrollments").upsert(
          { user_id: newUserId, course_id: body.course_id, is_active: true, expires_at: expiresAt },
          { onConflict: "user_id,course_id" },
        );
        if (body?.amount !== undefined) {
          await admin.from("payments").insert({
            user_id: newUserId,
            student_name: body?.full_name ?? null,
            amount: Number(body.amount) || 0,
            currency: body?.currency ?? "INR",  // M3: accept currency from caller
            gateway: body?.gateway ?? "cash",
            external_id: body?.external_id ?? null,
            status: "success",
          });
        }
      }

      return json(200, { success: true, user_id: newUserId });
    }

    if (action === "get_emails") {
      // M4: look up each ID individually — avoids the 1000-user listUsers cap
      const ids: string[] = Array.isArray(body?.user_ids) ? body.user_ids : [];
      if (!ids.length) return json(200, { emails: {} });
      const entries = await Promise.all(
        ids.map(async (id) => {
          const { data } = await admin.auth.admin.getUserById(id);
          return [id, data?.user?.email ?? null] as [string, string | null];
        }),
      );
      return json(200, { emails: Object.fromEntries(entries) });
    }

    if (action === "update") {
      const user_id = String(body?.user_id ?? "");
      if (!user_id) return json(400, { error: "user_id required" });
      if (!(await ensureStudent(user_id))) return json(403, { error: "Target is not a student" });

      // plan + goal excluded (plan is dead; goal = target_exam, use target_exam instead)
      const allowed = ["full_name", "phone", "target_exam", "class_level", "city", "country"];
      const update: Record<string, unknown> = { user_id };
      for (const k of allowed) {
        if (body?.[k] !== undefined) update[k] = body[k];
      }
      if (Object.keys(update).length > 1) {
        const { error: pErr } = await admin
          .from("profiles")
          .upsert(update, { onConflict: "user_id" });
        if (pErr) throw pErr;
      }
      return json(200, { success: true });
    }

    if (action === "enroll") {
      const user_id = String(body?.user_id ?? "");
      const course_id = String(body?.course_id ?? "");
      if (!user_id || !course_id) return json(400, { error: "user_id and course_id required" });
      if (!(await ensureStudent(user_id))) return json(403, { error: "Target is not a student" });
      const expiresAt = body?.expires_at ? new Date(body.expires_at).toISOString() : null;
      const { error: enrErr } = await admin.from("enrollments").upsert(
        { user_id, course_id, is_active: true, expires_at: expiresAt },
        { onConflict: "user_id,course_id" },
      );
      if (enrErr) throw enrErr;
      return json(200, { success: true });
    }

    if (action === "delete") {
      const user_id = String(body?.user_id ?? "");
      if (!user_id) return json(400, { error: "user_id required" });
      if (user_id === userData.user.id) return json(400, { error: "Cannot delete yourself" });
      if (!(await ensureStudent(user_id))) return json(403, { error: "Target is not a student" });
      // Cleanup roles then delete auth user (profile cascades via FK)
      await admin.from("user_roles").delete().eq("user_id", user_id);
      const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
      if (dErr) throw dErr;
      return json(200, { success: true });
    }

    if (action === "set_suspended") {
      const user_id = String(body?.user_id ?? "");
      const is_suspended = !!body?.is_suspended;
      if (!user_id) return json(400, { error: "user_id required" });
      if (user_id === userData.user.id) return json(400, { error: "Cannot suspend yourself" });
      if (!(await ensureStudent(user_id))) return json(403, { error: "Target is not a student" });
      const { error: pErr } = await admin
        .from("profiles")
        .update({ is_suspended })
        .eq("user_id", user_id);
      if (pErr) throw pErr;
      // Revoke all active sessions immediately when suspending
      if (is_suspended) {
        try { await admin.auth.admin.signOut(user_id); } catch (_) { /* ignore */ }
      }
      return json(200, { success: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
