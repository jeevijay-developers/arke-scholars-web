import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminUserRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  target_exam: string | null;
  is_suspended: boolean;
  created_at: string;
  email: string | null;
  role: "student" | "teacher" | "mentor" | "admin" | "super_admin";
};

const PAGE_SIZE = 50;
export const ADMIN_USERS_KEY = ["admin-users"] as const;

const fetchAdminUsers = async (filter: string, search: string, page: number) => {
  let query = supabase
    .from("profiles")
    .select(
      "user_id, full_name, phone, avatar_url, country, city, target_exam, is_suspended, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (search) {
    // Strip PostgREST .or() metacharacters to prevent filter injection (M2)
    const s = search.trim().replace(/[%,()*]/g, "");
    if (s) query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: profiles, count, error } = await query.range(from, to);
  if (error) throw error;

  const userIds = (profiles ?? []).map((p) => p.user_id);
  const { data: roleRows } = userIds.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
    : { data: [] as { user_id: string; role: AdminUserRow["role"] }[] };

  const priority: Record<string, number> = { super_admin: 5, admin: 4, teacher: 3, mentor: 2, student: 1 };
  const roleByUser = new Map<string, AdminUserRow["role"]>();
  (roleRows ?? []).forEach((r) => {
    const cur = roleByUser.get(r.user_id);
    if (!cur || (priority[r.role] ?? 0) > (priority[cur] ?? 0))
      roleByUser.set(r.user_id, r.role as AdminUserRow["role"]);
  });

  const merged: AdminUserRow[] = (profiles ?? []).map((p) => ({
    ...p,
    email: null,
    role: roleByUser.get(p.user_id) ?? "student",
  }));

  const filtered = filter === "all" ? merged : merged.filter((u) => u.role === filter);
  return { rows: filtered, total: count ?? 0 };
};

export const useAdminUsers = (filter: string, search: string, page: number) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [...ADMIN_USERS_KEY, filter, search, page],
    queryFn: () => fetchAdminUsers(filter, search, page),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    pageSize: PAGE_SIZE,
    reload: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
  };
};
