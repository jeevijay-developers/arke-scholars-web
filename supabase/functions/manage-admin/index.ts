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

const ALLOWED_ROLES = ["admin", "mentor", "teacher", "lead_manager"];

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$!";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

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
    const [{ data: isSuper }, { data: isAdminRole }] = await Promise.all([
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
    ]);
    if (!isSuper && !isAdminRole) return json(403, { error: "Only admins can manage staff" });
    const callerIsAdminOnly = !isSuper && !!isAdminRole;

    const body = await req.json();
    const action: string = body?.action;

    if (action === "list") {
      const { data: roleRows, error: rErr } = await admin
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin"]);
      if (rErr) throw rErr;
      const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
      const roleByUser = new Map<string, string>();
      const priority: Record<string, number> = { super_admin: 2, admin: 1 };
      (roleRows ?? []).forEach((r: any) => {
        const cur = roleByUser.get(r.user_id);
        if (!cur || (priority[r.role] ?? 0) > (priority[cur] ?? 0))
          roleByUser.set(r.user_id, r.role);
      });
      const { data: profiles } = ids.length
        ? await admin
            .from("profiles")
            .select("user_id, full_name, phone, avatar_url, is_suspended, created_at")
            .in("user_id", ids)
        : { data: [] as any[] };
      const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const userById = new Map<string, any>();
      (usersList?.users ?? []).forEach((u) => userById.set(u.id, u));
      const rows = ids.map((id) => {
        const p = (profiles ?? []).find((x: any) => x.user_id === id);
        const u = userById.get(id);
        const meta = (u?.user_metadata ?? {}) as Record<string, any>;
        return {
          user_id: id,
          email: u?.email ?? null,
          full_name: p?.full_name || meta.full_name || meta.name || null,
          phone: p?.phone || meta.phone || null,
          avatar_url: p?.avatar_url || meta.avatar_url || null,
          is_suspended: p?.is_suspended ?? false,
          created_at: p?.created_at ?? u?.created_at ?? null,
          role: roleByUser.get(id as string) ?? "admin",
        };
      });
      return json(200, { admins: rows });
    }

    if (action === "create") {
      const email = String(body?.email ?? "").toLowerCase().trim();
      const password = String(body?.password ?? "");
      const full_name = String(body?.full_name ?? "").trim();
      const phone = body?.phone ? String(body.phone).trim() : null;
      const app_role = ALLOWED_ROLES.includes(String(body?.app_role ?? ""))
        ? String(body.app_role)
        : "admin";

      if (!email || !password || password.length < 8 || !full_name)
        return json(400, { error: "email, full_name and password (min 8 chars) required" });
      if (callerIsAdminOnly && (app_role === "admin" || app_role === "super_admin"))
        return json(403, { error: "Admins can only create mentor, teacher, or lead_manager accounts" });

      const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
      let user = existing?.users.find((u: any) => u.email?.toLowerCase() === email);
      if (!user) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, phone },
          app_metadata: { must_change_password: true },
        });
        if (cErr) throw cErr;
        user = created.user!;
      } else {
        await admin.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
          app_metadata: { ...(user.app_metadata ?? {}), must_change_password: true },
        });
      }
      await admin
        .from("profiles")
        .upsert({ user_id: user.id, full_name, phone }, { onConflict: "user_id" });
      await admin.from("user_roles").delete().eq("user_id", user.id);
      const { error: rErr } = await admin
        .from("user_roles")
        .insert({ user_id: user.id, role: app_role });
      if (rErr) throw rErr;
      return json(200, { success: true, user_id: user.id, email, password });
    }

    if (action === "bulk_create") {
      const rows = (body?.rows ?? []) as Array<{
        full_name: string;
        email: string;
        phone?: string | null;
        role: string;
      }>;

      if (!Array.isArray(rows) || rows.length === 0)
        return json(400, { error: "rows array required" });
      if (rows.length > 200)
        return json(400, { error: "Maximum 200 rows per upload" });
      if (callerIsAdminOnly && rows.some((r) => r.role === "admin" || r.role === "super_admin"))
        return json(403, { error: "Admins can only create mentor, teacher, or lead_manager accounts" });

      // Pre-fetch all existing auth users to avoid N listUsers calls
      const { data: allUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existingByEmail = new Map<string, any>();
      (allUsersData?.users ?? []).forEach((u: any) => {
        if (u.email) existingByEmail.set(u.email.toLowerCase(), u);
      });

      const results = [];

      for (const row of rows) {
        const email = String(row.email ?? "").toLowerCase().trim();
        const full_name = String(row.full_name ?? "").trim();
        const phone = row.phone ? String(row.phone).trim() : null;
        const app_role = ALLOWED_ROLES.includes(String(row.role ?? ""))
          ? String(row.role)
          : null;

        if (!email || !full_name) {
          results.push({
            full_name: row.full_name ?? "",
            email: row.email ?? "",
            phone: row.phone ?? "",
            role: row.role ?? "",
            password: "",
            status: "error",
            error: "Missing name or email",
          });
          continue;
        }
        if (!app_role) {
          results.push({
            full_name,
            email,
            phone: row.phone ?? "",
            role: row.role ?? "",
            password: "",
            status: "error",
            error: `Invalid role. Use: ${ALLOWED_ROLES.join(", ")}`,
          });
          continue;
        }

        const password = generatePassword();

        try {
          let user = existingByEmail.get(email);

          if (!user) {
            const { data: created, error: cErr } = await admin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name, phone },
              app_metadata: { must_change_password: true },
            });
            if (cErr) throw cErr;
            user = created.user!;
            existingByEmail.set(email, user);
          } else {
            await admin.auth.admin.updateUserById(user.id, {
              password,
              email_confirm: true,
              app_metadata: { ...(user.app_metadata ?? {}), must_change_password: true },
            });
          }

          await admin
            .from("profiles")
            .upsert({ user_id: user.id, full_name, phone }, { onConflict: "user_id" });
          await admin.from("user_roles").delete().eq("user_id", user.id);
          await admin.from("user_roles").insert({ user_id: user.id, role: app_role });

          results.push({
            full_name,
            email,
            phone: phone ?? "",
            role: app_role,
            password,
            status: "created",
            error: "",
          });
        } catch (e) {
          results.push({
            full_name,
            email,
            phone: phone ?? "",
            role: app_role,
            password: "",
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return json(200, { results });
    }

    if (action === "update") {
      const user_id = String(body?.user_id ?? "");
      const full_name = body?.full_name != null ? String(body.full_name) : undefined;
      const phone = body?.phone != null ? String(body.phone) : undefined;
      const password = body?.password ? String(body.password) : undefined;
      if (!user_id) return json(400, { error: "user_id required" });

      const { data: targetIsSuper } = await admin.rpc("has_role", {
        _user_id: user_id,
        _role: "super_admin",
      });
      if (targetIsSuper) return json(403, { error: "Cannot modify another super admin" });

      if (password) {
        if (password.length < 8) return json(400, { error: "Password must be 8+ chars" });
        await admin.auth.admin.updateUserById(user_id, {
          password,
          app_metadata: { must_change_password: true },
        });
      }
      const profileUpdate: Record<string, unknown> = { user_id };
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (phone !== undefined) profileUpdate.phone = phone;
      if (Object.keys(profileUpdate).length > 1) {
        const { error: pErr } = await admin
          .from("profiles")
          .upsert(profileUpdate, { onConflict: "user_id" });
        if (pErr) throw pErr;
        const { data: existing } = await admin.auth.admin.getUserById(user_id);
        const meta = { ...(existing?.user?.user_metadata ?? {}) };
        if (full_name !== undefined) meta.full_name = full_name;
        if (phone !== undefined) meta.phone = phone;
        await admin.auth.admin.updateUserById(user_id, { user_metadata: meta });
      }
      return json(200, { success: true });
    }

    if (action === "set_suspended") {
      const user_id = String(body?.user_id ?? "");
      const is_suspended = !!body?.is_suspended;
      if (!user_id) return json(400, { error: "user_id required" });
      const { data: targetIsSuper } = await admin.rpc("has_role", {
        _user_id: user_id,
        _role: "super_admin",
      });
      if (targetIsSuper) return json(403, { error: "Cannot suspend a super admin" });
      await admin.from("profiles").update({ is_suspended }).eq("user_id", user_id);
      if (is_suspended) {
        try { await admin.auth.admin.signOut(user_id); } catch (_) { /* ignore */ }
      }
      return json(200, { success: true });
    }

    if (action === "delete") {
      const user_id = String(body?.user_id ?? "");
      if (!user_id) return json(400, { error: "user_id required" });
      if (user_id === userData.user.id)
        return json(400, { error: "Cannot delete yourself" });
      const { data: targetIsSuper } = await admin.rpc("has_role", {
        _user_id: user_id,
        _role: "super_admin",
      });
      if (targetIsSuper) return json(403, { error: "Cannot delete a super admin" });
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.auth.admin.deleteUser(user_id);
      return json(200, { success: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
