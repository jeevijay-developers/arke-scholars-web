import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Row = {
  full_name?: string;
  email?: string;
  phone?: string;
  class_level?: string;
  target_exam?: string;
  city?: string;
};

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out + "!9";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const callerId = userData.user.id;
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      admin.rpc("has_role", { _user_id: callerId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: callerId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuper) return json(403, { error: "Only admins can onboard school students" });

    const body = await req.json().catch(() => ({}));
    const schoolId: string | undefined = body?.school_id;
    const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!schoolId || !rows.length) return json(400, { error: "school_id and rows are required" });
    if (rows.length > 500) return json(400, { error: "Max 500 rows per request" });

    const { data: school, error: sErr } = await admin
      .from("schools")
      .select("id, name")
      .eq("id", schoolId)
      .maybeSingle();
    if (sErr || !school) return json(404, { error: "School not found" });

    // Pre-fetch existing users for email lookup
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailToUser = new Map<string, string>();
    (usersList?.users ?? []).forEach((u) => {
      if (u.email) emailToUser.set(u.email.toLowerCase(), u.id);
    });

    const results: Array<Record<string, unknown>> = [];

    for (const raw of rows) {
      const email = (raw.email ?? "").toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ email: raw.email ?? null, status: "error", error: "Invalid email" });
        continue;
      }
      try {
        let userId = emailToUser.get(email);
        let createdNew = false;
        let tempPassword: string | null = null;

        if (!userId) {
          tempPassword = randomPassword();
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: raw.full_name ?? "",
              phone: raw.phone ?? null,
              target_exam: raw.target_exam ?? null,
              class_level: raw.class_level ?? null,
              city: raw.city ?? null,
            },
            app_metadata: { must_change_password: true },
          });
          if (cErr || !created.user) throw cErr ?? new Error("createUser failed");
          userId = created.user.id;
          createdNew = true;
          emailToUser.set(email, userId);

          // Ensure student role
          await admin.from("user_roles").upsert(
            { user_id: userId, role: "student" },
            { onConflict: "user_id,role" },
          );
        } else {
          // Skip if non-student (admin/super_admin/teacher/mentor)
          const { data: roles } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const roleSet = new Set((roles ?? []).map((r) => r.role));
          if (roleSet.has("admin") || roleSet.has("super_admin") || roleSet.has("teacher") || roleSet.has("mentor")) {
            results.push({ email, status: "error", error: "Email belongs to a non-student account" });
            continue;
          }
          if (!roleSet.has("student")) {
            await admin.from("user_roles").upsert(
              { user_id: userId, role: "student" },
              { onConflict: "user_id,role" },
            );
          }
        }

        // Upsert profile with school link
        const profileUpdate: Record<string, unknown> = {
          user_id: userId,
          school_id: schoolId,
        };
        if (raw.full_name) profileUpdate.full_name = raw.full_name;
        if (raw.phone) profileUpdate.phone = raw.phone;
        if (raw.target_exam) profileUpdate.target_exam = raw.target_exam;
        if (raw.class_level) profileUpdate.class_level = raw.class_level;
        if (raw.city) profileUpdate.city = raw.city;

        const { error: pErr } = await admin
          .from("profiles")
          .upsert(profileUpdate, { onConflict: "user_id" });
        if (pErr) throw pErr;

        results.push({
          email,
          status: createdNew ? "created" : "linked_existing",
          temp_password: tempPassword,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ email, status: "error", error: msg });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      linked_existing: results.filter((r) => r.status === "linked_existing").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return json(200, { success: true, school: school.name, summary, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
