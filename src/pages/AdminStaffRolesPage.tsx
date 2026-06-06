import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PAGE_KEYS, type AdminPageKey } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  ShieldPlus, Plus, Loader2, Check, Copy, ChevronRight,
  Pencil, Trash2, Lock, Unlock, Users, KeyRound, X,
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
const MANAGEABLE_BY_ADMIN = ["mentor", "lead_manager"];

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

  // Dialogs
  const [showNewRole, setShowNewRole] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
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
      return (data ?? []) as StaffMember[];
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
        return { staff_role_id: selectedRole.id, page_key: key, can_view: p.can_view,
          can_edit: p.can_edit, can_delete: p.can_delete, can_approve: p.can_approve, can_export: p.can_export };
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
        {isSuperAdmin && (
          <Button onClick={() => setShowAddStaff(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        )}
      </div>

      {/* ── Staff Members table ── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Staff Members
        </h2>
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
                {staffMembers.map((m) => {
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
                        {m.custom_role_name
                          ? <Badge variant="secondary">{m.custom_role_name}</Badge>
                          : <span className="text-xs text-destructive font-medium">No access role</span>}
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
                              <Button variant="ghost" size="sm" title="Change access role"
                                onClick={() => setAssignRoleMember(m)}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
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

      {/* ── Access Roles section (super_admin only) ── */}
      {isSuperAdmin && (
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

const ADD_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "lead_manager", label: "Lead Manager" },
];

const AddStaffDialog = ({ open, roles, onClose, onCreated }: {
  open: boolean; roles: StaffRole[]; onClose: () => void; onCreated: () => void;
}) => {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [appRole, setAppRole] = useState("admin");
  const [staffRoleId, setStaffRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setPassword("");
      setAppRole("admin"); setStaffRoleId(""); setCreated(null); setCopied(false);
    }
  }, [open]);

  const submit = async () => {
    if (!email || !full_name || password.length < 8) {
      toast.error("Name, email and 8+ char password required"); return;
    }
    if (!staffRoleId) { toast.error("Please select an access role"); return; }
    setBusy(true);
    try {
      const res = await callFn("create", { full_name, email, phone: phone || null, password, app_role: appRole });
      const userId: string = res.user_id;
      const { error } = await supabase.from("staff_role_assignments")
        .upsert({ user_id: userId, staff_role_id: staffRoleId }, { onConflict: "user_id,staff_role_id" });
      if (error) throw error;
      setCreated({ email: res.email, password: res.password });
      toast.success("Staff member added");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Staff credentials" : "Add Staff Member"}</DialogTitle>
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
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Password (min 8 chars)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div>
              <Label>System role</Label>
              <Select value={appRole} onValueChange={setAppRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADD_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Access role <span className="text-muted-foreground">(defines page permissions)</span></Label>
              <Select value={staffRoleId} onValueChange={setStaffRoleId}>
                <SelectTrigger><SelectValue placeholder="Select access role…" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Staff
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

export default AdminStaffRolesPage;
