import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PAGE_KEYS, type AdminPageKey } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  ShieldPlus, Plus, Loader2, Check, Copy, ChevronRight,
  Pencil, Trash2, Lock, Unlock, Users, KeyRound, X,
  Upload, Download, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRole = { id: string; name: string; description: string | null; created_at: string };

type StaffMember = {
  user_id: string;
  full_name: string;
  email: string;
  app_role: string;
  custom_role_name: string | null;
  custom_role_id: string | null;
  is_suspended: boolean;
};

type Permission = {
  page_key: AdminPageKey;
  can_view: boolean; can_edit: boolean; can_delete: boolean;
  can_approve: boolean; can_export: boolean;
};
type PermMap = Partial<Record<AdminPageKey, Permission>>;

const PERMISSION_COLS = [
  { key: "can_view" as const, label: "View" },
  { key: "can_edit" as const, label: "Edit" },
  { key: "can_delete" as const, label: "Delete" },
  { key: "can_approve" as const, label: "Approve" },
  { key: "can_export" as const, label: "Export" },
];

const emptyPerm = (page_key: AdminPageKey): Permission => ({
  page_key, can_view: false, can_edit: false, can_delete: false,
  can_approve: false, can_export: false,
});

// Role hierarchy: super_admin can manage all; admin can manage lower roles only.
const MANAGEABLE_BY_ADMIN = ["mentor", "teacher", "lead_manager"];

const callFn = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("manage-admin", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminStaffRolesPage = () => {
  const { isSuperAdmin, isAdmin } = useAuth();
  const qc = useQueryClient();

  // Role permissions panel state
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null);
  const [permMap, setPermMap] = useState<PermMap>({});
  const [permsDirty, setPermsDirty] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // Staff table filter tab
  const [memberTab, setMemberTab] = useState<"all" | "academic" | "staff">("all");

  // Dialogs
  const [showNewRole, setShowNewRole] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [assignRoleMember, setAssignRoleMember] = useState<StaffMember | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<StaffMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="container max-w-2xl mx-auto p-6 text-center text-muted-foreground">
        Access restricted to admins.
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: roles = [], isLoading: rolesLoading } = useQuery<StaffRole[]>({
    queryKey: ["staff-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_roles").select("id, name, description, created_at").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: staffMembers = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_staff_members");
      if (error) throw error;
      return ((data ?? []) as StaffMember[]).filter((m) => m.app_role !== "super_admin");
    },
    staleTime: 60_000,
  });

  // ── Permission matrix logic ───────────────────────────────────────────────

  const loadPerms = useCallback(async (roleId: string) => {
    const { data, error } = await supabase
      .from("staff_role_permissions")
      .select("page_key, can_view, can_edit, can_delete, can_approve, can_export")
      .eq("staff_role_id", roleId);
    if (error) { toast.error("Failed to load permissions"); return; }
    const map: PermMap = {};
    for (const p of data ?? []) map[p.page_key as AdminPageKey] = p as Permission;
    setPermMap(map);
    setPermsDirty(false);
  }, []);

  useEffect(() => { if (selectedRole) loadPerms(selectedRole.id); }, [selectedRole, loadPerms]);

  const togglePerm = (pageKey: AdminPageKey, col: keyof Omit<Permission, "page_key">) => {
    setPermMap((prev) => {
      const cur = prev[pageKey] ?? emptyPerm(pageKey);
      return { ...prev, [pageKey]: { ...cur, [col]: !cur[col] } };
    });
    setPermsDirty(true);
  };

  const isColAllChecked = (col: keyof Omit<Permission, "page_key">) =>
    ADMIN_PAGE_KEYS.every(({ key }) => (permMap[key] ?? emptyPerm(key))[col]);

  const isColPartial = (col: keyof Omit<Permission, "page_key">) => {
    const n = ADMIN_PAGE_KEYS.filter(({ key }) => (permMap[key] ?? emptyPerm(key))[col]).length;
    return n > 0 && n < ADMIN_PAGE_KEYS.length;
  };

  const toggleCol = (col: keyof Omit<Permission, "page_key">) => {
    const allOn = isColAllChecked(col);
    setPermMap((prev) => {
      const next = { ...prev };
      for (const { key } of ADMIN_PAGE_KEYS) {
        const cur = next[key] ?? emptyPerm(key);
        next[key] = { ...cur, [col]: !allOn };
      }
      return next;
    });
    setPermsDirty(true);
  };

  const savePerms = async () => {
    if (!selectedRole) return;
    setSavingPerms(true);
    try {
      const rows = ADMIN_PAGE_KEYS.map(({ key }) => {
        const p = permMap[key] ?? emptyPerm(key);
        return {
          staff_role_id: selectedRole.id, page_key: key, can_view: p.can_view,
          can_edit: p.can_edit, can_delete: p.can_delete, can_approve: p.can_approve, can_export: p.can_export
        };
      });
      const { error } = await supabase.from("staff_role_permissions")
        .upsert(rows, { onConflict: "staff_role_id,page_key" });
      if (error) throw error;
      toast.success("Permissions saved");
      setPermsDirty(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingPerms(false); }
  };

  // ── Member actions ────────────────────────────────────────────────────────

  const canManage = (member: StaffMember) =>
    isSuperAdmin || (isAdmin && MANAGEABLE_BY_ADMIN.includes(member.app_role));

  const handleBlock = async (member: StaffMember) => {
    try {
      await callFn("set_suspended", { user_id: member.user_id, is_suspended: !member.is_suspended });
      toast.success(member.is_suspended ? "Staff member unblocked" : "Staff member blocked");
      qc.invalidateQueries({ queryKey: ["staff-members"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setConfirmBlock(null);
  };

  const handleDelete = async (member: StaffMember) => {
    try {
      await callFn("delete", { user_id: member.user_id });
      toast.success("Staff member deleted");
      qc.invalidateQueries({ queryKey: ["staff-members"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setConfirmDelete(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-navy flex items-center gap-2">
            <ShieldPlus className="h-6 w-6 text-primary" /> Staff Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff members and their page-level access roles.
          </p>
        </div>
        {(isSuperAdmin || isAdmin) && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <Button onClick={() => setShowAddStaff(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Staff
            </Button>
          </div>
        )}
      </div>

      {/* ── Staff Members table ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Staff Members
          </h2>
          {/* Tab filter */}
          <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5 text-xs font-medium">
            {(["all", "academic", "staff"] as const).map((tab) => {
              const count =
                tab === "all" ? staffMembers.length
                : tab === "academic" ? staffMembers.filter((m) => m.app_role === "mentor" || m.app_role === "teacher").length
                : staffMembers.filter((m) => m.app_role !== "mentor" && m.app_role !== "teacher").length;
              return (
                <button
                  key={tab}
                  onClick={() => setMemberTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 capitalize transition-colors",
                    memberTab === tab
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          {staffLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No staff members found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Access Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers
                  .filter((m) =>
                    memberTab === "all" ? true
                    : memberTab === "academic" ? (m.app_role === "mentor" || m.app_role === "teacher")
                    : (m.app_role !== "mentor" && m.app_role !== "teacher")
                  )
                  .map((m) => {
                  const manageable = canManage(m);
                  return (
                    <tr key={m.user_id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{m.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {m.app_role.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {m.custom_role_name ? (
                          <Badge variant="secondary">{m.custom_role_name}</Badge>
                        ) : (m.app_role === "mentor" || m.app_role === "teacher") ? (
                          <span className="text-xs text-muted-foreground">Own dashboard</span>
                        ) : (
                          <span className="text-xs text-destructive font-medium">No access role</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.is_suspended
                          ? <Badge variant="destructive">Blocked</Badge>
                          : <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {manageable && (
                            <>
                              <Button variant="ghost" size="sm" title="Edit profile"
                                onClick={() => setEditMember(m)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {m.app_role !== "mentor" && m.app_role !== "teacher" && (
                                <Button variant="ghost" size="sm" title="Change access role"
                                  onClick={() => setAssignRoleMember(m)}>
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm"
                                title={m.is_suspended ? "Unblock" : "Block"}
                                onClick={() => setConfirmBlock(m)}>
                                {m.is_suspended
                                  ? <Unlock className="h-4 w-4 text-emerald-600" />
                                  : <Lock className="h-4 w-4 text-amber-600" />}
                              </Button>
                              <Button variant="ghost" size="sm" title="Delete"
                                onClick={() => setConfirmDelete(m)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Access Roles section ── */}
      {(isSuperAdmin || isAdmin) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldPlus className="h-4 w-4 text-primary" /> Access Roles
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowNewRole(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Role
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            {/* Role list */}
            <div className="rounded-xl border bg-card overflow-hidden h-fit">
              {rolesLoading ? (
                <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
              ) : roles.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No roles yet.</div>
              ) : (
                <ul>
                  {roles.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => setSelectedRole(r)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-sm text-left border-b last:border-b-0 transition-colors",
                          selectedRole?.id === r.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div>
                          <p className="font-medium">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{r.description}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Permission matrix */}
            {selectedRole ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{selectedRole.name}</h3>
                    {selectedRole.description && (
                      <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
                    )}
                  </div>
                  <Button onClick={savePerms} disabled={!permsDirty || savingPerms} className="gap-2">
                    {savingPerms && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Permissions
                  </Button>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-semibold">Page / Section</th>
                          {PERMISSION_COLS.map((c) => (
                            <th key={c.key} className="px-3 py-3 font-semibold text-center w-20">
                              <div className="flex flex-col items-center gap-1">
                                <span>{c.label}</span>
                                <Checkbox
                                  checked={isColPartial(c.key) ? "indeterminate" : isColAllChecked(c.key)}
                                  onCheckedChange={() => toggleCol(c.key)}
                                  aria-label={`Toggle all ${c.label}`}
                                  className="border-primary"
                                />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ADMIN_PAGE_KEYS.map(({ key, label }) => {
                          const p = permMap[key] ?? emptyPerm(key);
                          return (
                            <tr key={key} className="border-t hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium">{label}</td>
                              {PERMISSION_COLS.map((col) => (
                                <td key={col.key} className="px-3 py-2.5 text-center">
                                  <Checkbox checked={p[col.key]} onCheckedChange={() => togglePerm(key, col.key)} />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/30 flex items-center justify-center h-48 text-sm text-muted-foreground">
                Select a role to manage its permissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <BulkStaffUploadDialog
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["staff-members"] })}
      />

      <NewRoleDialog
        open={showNewRole}
        onClose={() => setShowNewRole(false)}
        onCreated={(role) => {
          qc.invalidateQueries({ queryKey: ["staff-roles"] });
          setShowNewRole(false);
          setSelectedRole(role);
        }}
      />

      <AddStaffDialog
        open={showAddStaff}
        roles={roles}
        onClose={() => setShowAddStaff(false)}
        onCreated={() => {
          setShowAddStaff(false);
          qc.invalidateQueries({ queryKey: ["staff-members"] });
        }}
      />

      <EditMemberDialog
        member={editMember}
        onClose={() => setEditMember(null)}
        onSaved={() => { setEditMember(null); qc.invalidateQueries({ queryKey: ["staff-members"] }); }}
      />

      <AssignRoleDialog
        member={assignRoleMember}
        roles={roles}
        onClose={() => setAssignRoleMember(null)}
        onSaved={() => { setAssignRoleMember(null); qc.invalidateQueries({ queryKey: ["staff-members"] }); }}
      />

      <AlertDialog open={!!confirmBlock} onOpenChange={(o) => !o && setConfirmBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmBlock?.is_suspended ? "Unblock staff member?" : "Block staff member?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBlock?.is_suspended
                ? `Restore access for ${confirmBlock?.full_name || confirmBlock?.email}.`
                : `Revoke access for ${confirmBlock?.full_name || confirmBlock?.email}. They will be signed out immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmBlock && handleBlock(confirmBlock)}>
              {confirmBlock?.is_suspended ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete {confirmDelete?.full_name || confirmDelete?.email}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── New Role Dialog ───────────────────────────────────────────────────────────

const NewRoleDialog = ({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (role: StaffRole) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setName(""); setDescription(""); } }, [open]);

  const submit = async () => {
    if (!name.trim()) { toast.error("Role name is required"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("staff_roles")
        .insert({ name: name.trim(), description: description.trim() || null })
        .select("id, name, description, created_at").single();
      if (error) throw error;
      toast.success(`Role "${data.name}" created`);
      onCreated(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create role"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Access Role</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Role name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Content Manager" />
          </div>
          <div>
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Manages courses and tests" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Add Staff Dialog ──────────────────────────────────────────────────────────

type RoleCategory = "academic" | "staff";

const ACADEMIC_ROLES = [
  { value: "mentor", label: "Mentor" },
  { value: "teacher", label: "Teacher" },
];

const STAFF_ROLES = [
  { value: "lead_manager", label: "Lead Manager" },
  { value: "admin", label: "Admin" },
];

const AddStaffDialog = ({ open, roles, onClose, onCreated }: {
  open: boolean; roles: StaffRole[]; onClose: () => void; onCreated: () => void;
}) => {
  const [category, setCategory] = useState<RoleCategory>("staff");
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [appRole, setAppRole] = useState("lead_manager");
  const [staffRoleId, setStaffRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("staff");
      setName(""); setEmail(""); setPhone(""); setPassword("");
      setAppRole("lead_manager"); setStaffRoleId(""); setCreated(null); setCopied(false);
    }
  }, [open]);

  const handleCategoryChange = (cat: RoleCategory) => {
    setCategory(cat);
    setAppRole(cat === "academic" ? "mentor" : "lead_manager");
    setStaffRoleId("");
  };

  const roleOptions = category === "academic" ? ACADEMIC_ROLES : STAFF_ROLES;

  const submit = async () => {
    if (!email || !full_name || password.length < 8) {
      toast.error("Name, email and 8+ char password required"); return;
    }
    if (category === "staff" && !staffRoleId) {
      toast.error("Please select an access role"); return;
    }
    setBusy(true);
    try {
      const res = await callFn("create", { full_name, email, phone: phone || null, password, app_role: appRole });
      if (category === "staff" && staffRoleId) {
        const { error } = await supabase.from("staff_role_assignments")
          .upsert({ user_id: res.user_id, staff_role_id: staffRoleId }, { onConflict: "user_id,staff_role_id" });
        if (error) throw error;
      }
      setCreated({ email: res.email, password: res.password });
      toast.success(`${category === "academic" ? "Academic member" : "Staff member"} added`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Credentials" : "Add Staff Member"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Share these credentials securely.</p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div><span className="font-semibold">Email:</span> {created.email}</div>
              <div><span className="font-semibold">Password:</span> <code>{created.password}</code></div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => {
              navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
              setCopied(true); setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
            <DialogFooter><Button onClick={onCreated}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category toggle */}
            <div>
              <Label className="mb-2 block">Role type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["academic", "staff"] as RoleCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={cn(
                      "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors text-left",
                      category === cat
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cat === "academic" ? (
                      <>
                        <p className="font-semibold capitalize">Academic</p>
                        <p className="text-xs opacity-70">Mentor · Teacher</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold capitalize">Staff</p>
                        <p className="text-xs opacity-70">Admin · Lead Manager</p>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone </Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Password (min 8 chars)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={appRole} onValueChange={setAppRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {category === "staff" && (
              <div>
                <Label>Access role <span className="text-muted-foreground">(defines page permissions)</span></Label>
                <Select value={staffRoleId} onValueChange={setStaffRoleId}>
                  <SelectTrigger><SelectValue placeholder="Select access role…" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Academic members (mentor/teacher) use their own dashboards and don't need page permissions.</p>
              </div>
            )}

            {category === "academic" && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 border px-3 py-2">
                Academic members have their own dedicated dashboards. No admin page permissions are required.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Member
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Edit Member Dialog ────────────────────────────────────────────────────────

const EditMemberDialog = ({ member, onClose, onSaved }: {
  member: StaffMember | null; onClose: () => void; onSaved: () => void;
}) => {
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) { setName(member.full_name || ""); setPhone(""); setPassword(""); }
  }, [member]);

  if (!member) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { user_id: member.user_id, full_name, phone };
      if (password) {
        if (password.length < 8) { toast.error("Password must be 8+ chars"); setBusy(false); return; }
        payload.password = password;
      }
      await callFn("update", payload);
      toast.success("Updated");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit · {member.email}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>Reset password <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Assign Role Dialog ────────────────────────────────────────────────────────

const AssignRoleDialog = ({ member, roles, onClose, onSaved }: {
  member: StaffMember | null; roles: StaffRole[]; onClose: () => void; onSaved: () => void;
}) => {
  const [staffRoleId, setStaffRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) setStaffRoleId(member.custom_role_id ?? "");
  }, [member]);

  if (!member) return null;

  const submit = async () => {
    setBusy(true);
    try {
      // Remove all existing role assignments for this user
      await supabase.from("staff_role_assignments").delete().eq("user_id", member.user_id);
      if (staffRoleId) {
        const { error } = await supabase.from("staff_role_assignments")
          .insert({ user_id: member.user_id, staff_role_id: staffRoleId });
        if (error) throw error;
      }
      toast.success(staffRoleId ? "Access role assigned" : "Access role removed");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change access role · {member.full_name || member.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The access role controls which admin pages this staff member can see and interact with.
            Setting no role means zero access.
          </p>
          <div>
            <Label>Access role</Label>
            <Select value={staffRoleId} onValueChange={setStaffRoleId}>
              <SelectTrigger><SelectValue placeholder="No access role (zero access)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="flex items-center gap-2"><X className="h-3 w-3 text-destructive" /> No access (remove role)</span>
                </SelectItem>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {staffRoleId && (
            <p className="text-xs text-muted-foreground">
              Permissions are defined by the selected role. Edit them in the Access Roles section.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Bulk Staff Upload Dialog ──────────────────────────────────────────────────

const VALID_BULK_ROLES = ["admin", "mentor", "teacher", "lead_manager"];
const BULK_CSV_TEMPLATE =
  "full_name,email,phone,role\n" +
  "Rahul Sharma,rahul@example.com,9876543210,mentor\n" +
  "Priya Singh,priya@example.com,8765432100,teacher\n" +
  "Amit Kumar,amit@example.com,9123456780,lead_manager\n" +
  "Neha Joshi,neha@example.com,9012345678,admin\n";

type BulkRow = { full_name: string; email: string; phone: string; role: string };
type BulkResult = BulkRow & { password: string; status: "created" | "error"; error: string };

function parseBulkCsv(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return { full_name: obj.full_name ?? "", email: obj.email ?? "", phone: obj.phone ?? "", role: obj.role ?? "" };
  });
}

const BulkStaffUploadDialog = ({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) => {
  const [phase, setPhase] = useState<"upload" | "results">("upload");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setPhase("upload"); setRows([]); setResults([]); } }, [open]);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseBulkCsv(String(e.target?.result ?? ""));
      if (parsed.length === 0) { toast.error("No data rows found"); return; }
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([BULK_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "staff_upload_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "bulk_create", rows },
      });
      if (error) throw error;
      const result = data as { error?: string; results?: BulkResult[] };
      if (result?.error) throw new Error(result.error);
      setResults(result?.results ?? []);
      setPhase("results");
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bulk create failed"); }
    finally { setBusy(false); }
  };

  const downloadCredentials = () => {
    const header = "full_name,email,phone,role,password,status,error";
    const lines = results.map((r) =>
      [r.full_name, r.email, r.phone, r.role, r.password, r.status, r.error]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "staff_credentials.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const invalidRows = rows.filter((r) => !r.full_name || !r.email || !VALID_BULK_ROLES.includes(r.role));
  const validCount = rows.length - invalidRows.length;
  const createdCount = results.filter((r) => r.status === "created").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: "85vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {phase === "upload" ? "Bulk Upload Staff" : "Upload Results"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
          {phase === "upload" ? (
            <>
              {/* Format hint + template */}
              <div className="flex items-start justify-between rounded-lg border bg-muted/30 px-4 py-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Columns: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">full_name, email, phone, role</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Academic roles:</span> mentor, teacher — use their own dashboards, no page permissions assigned.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Staff roles:</span> lead_manager, admin — assign an access role separately after upload.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Template
                </Button>
              </div>

              {/* Drop zone */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 py-10 cursor-pointer transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Max 200 rows per upload</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </div>

              {/* Preview table */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold">{rows.length} row{rows.length !== 1 ? "s" : ""} parsed</span>
                    {validCount > 0 && <span className="text-emerald-600 font-medium">{validCount} ready</span>}
                    {invalidRows.length > 0 && (
                      <span className="text-destructive font-medium">{invalidRows.length} invalid</span>
                    )}
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-semibold">Name</th>
                          <th className="px-3 py-2 font-semibold">Email</th>
                          <th className="px-3 py-2 font-semibold">Phone</th>
                          <th className="px-3 py-2 font-semibold">Role</th>
                          <th className="px-3 py-2 font-semibold w-12 text-center">OK?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const ok = r.full_name && r.email && VALID_BULK_ROLES.includes(r.role);
                          return (
                            <tr key={i} className={cn("border-t", !ok && "bg-destructive/5")}>
                              <td className="px-3 py-1.5">{r.full_name || <span className="text-destructive">—</span>}</td>
                              <td className="px-3 py-1.5">{r.email || <span className="text-destructive">—</span>}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{r.phone || "—"}</td>
                              <td className="px-3 py-1.5">
                                <Badge variant={VALID_BULK_ROLES.includes(r.role) ? "outline" : "destructive"} className="capitalize text-[10px] py-0">
                                  {r.role || "—"}
                                </Badge>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {ok
                                  ? <Check className="h-3.5 w-3.5 text-emerald-600 inline" />
                                  : <X className="h-3.5 w-3.5 text-destructive inline" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 rounded-lg bg-muted/30 border px-4 py-3">
                <span className="text-sm font-semibold text-emerald-600">{createdCount} created</span>
                {errorCount > 0 && <span className="text-sm font-semibold text-destructive">{errorCount} failed</span>}
                <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={downloadCredentials}>
                  <Download className="h-3.5 w-3.5" /> Download Credentials CSV
                </Button>
              </div>

              {/* Results table */}
              <div className="max-h-72 overflow-y-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Role</th>
                      <th className="px-3 py-2 font-semibold">Password / Error</th>
                      <th className="px-3 py-2 font-semibold w-20 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className={cn("border-t", r.status === "error" && "bg-destructive/5")}>
                        <td className="px-3 py-1.5">{r.full_name}</td>
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className="capitalize text-[10px] py-0">{r.role}</Badge>
                        </td>
                        <td className="px-3 py-1.5">
                          {r.status === "created"
                            ? <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono select-all">{r.password}</code>
                            : <span className="text-destructive text-[10px]">{r.error}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {r.status === "created"
                            ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] py-0">Created</Badge>
                            : <Badge variant="destructive" className="text-[10px] py-0">Error</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2">
          {phase === "upload" ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={busy || validCount === 0}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {validCount > 0 ? `${validCount} Account${validCount !== 1 ? "s" : ""}` : "Accounts"}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminStaffRolesPage;
