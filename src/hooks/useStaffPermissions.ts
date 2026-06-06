import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { StaffPagePermission } from "@/lib/constants";

type PermissionsMap = Record<string, StaffPagePermission>;

/**
 * Returns a map of page_key → permission flags for the current staff member.
 * - super_admin: returns null (bypass all checks — sees everything)
 * - admin / lead_manager with a staff_role_assignment: returns their merged permissions
 * - admin / lead_manager with NO assignment: returns {} (zero access — must be assigned a role)
 */
export function useStaffPermissions(): {
  permissions: PermissionsMap | null;
  isLoading: boolean;
} {
  const { role, isSuperAdmin, roleReady } = useAuth();

  // Super admins bypass the permission matrix entirely.
  const skip = !roleReady || isSuperAdmin;

  const { data, isLoading } = useQuery<PermissionsMap | null>({
    queryKey: ["staff-permissions", role],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data: assignments, error: aErr } = await supabase
        .from("staff_role_assignments")
        .select("staff_role_id")
        .eq("user_id", user.id);
      if (aErr) throw aErr;

      // No role assigned → zero access
      if (!assignments || assignments.length === 0) return {};

      const roleIds = assignments.map((a) => a.staff_role_id);
      const { data: perms, error: pErr } = await supabase
        .from("staff_role_permissions")
        .select("page_key, can_view, can_edit, can_delete, can_approve, can_export")
        .in("staff_role_id", roleIds);
      if (pErr) throw pErr;

      // Merge permissions across multiple roles — any true wins (union).
      const map: PermissionsMap = {};
      for (const p of perms ?? []) {
        const existing = map[p.page_key];
        map[p.page_key] = {
          page_key: p.page_key as StaffPagePermission["page_key"],
          can_view: (existing?.can_view ?? false) || p.can_view,
          can_edit: (existing?.can_edit ?? false) || p.can_edit,
          can_delete: (existing?.can_delete ?? false) || p.can_delete,
          can_approve: (existing?.can_approve ?? false) || p.can_approve,
          can_export: (existing?.can_export ?? false) || p.can_export,
        };
      }
      return map;
    },
    enabled: !skip,
    staleTime: 5 * 60 * 1000,
  });

  if (skip) return { permissions: null, isLoading: false };

  return { permissions: data !== undefined ? data : null, isLoading };
}
