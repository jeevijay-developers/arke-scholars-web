import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Lock, Unlock, ShieldCheck, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type AdminRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  created_at: string | null;
  role: "admin" | "super_admin";
};

const callFn = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("manage-admin", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

const AdminAdminsPage = () => {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminRow | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<AdminRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callFn("list");
      setRows(res.admins ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-mgmt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-black text-navy flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, edit, block or remove admin accounts. Super admins are protected.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No admins yet.
                </td></tr>
              ) : rows.map((r) => {
                const isSuper = r.role === "super_admin";
                return (
                  <tr key={r.user_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isSuper ? "default" : "secondary"}>
                        {isSuper ? "Super Admin" : "Admin"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.is_suspended ? (
                        <Badge variant="destructive">Blocked</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={isSuper}
                          onClick={() => setEditing(r)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled={isSuper}
                          onClick={() => setConfirmBlock(r)}
                          title={r.is_suspended ? "Unblock" : "Block"}>
                          {r.is_suspended
                            ? <Unlock className="h-4 w-4 text-emerald-600" />
                            : <Lock className="h-4 w-4 text-amber-600" />}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={isSuper}
                          onClick={() => setConfirmDelete(r)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateAdminDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); load(); }}
      />

      <EditAdminDialog
        admin={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      <AlertDialog open={!!confirmBlock} onOpenChange={(o) => !o && setConfirmBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmBlock?.is_suspended ? "Unblock admin?" : "Block admin?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBlock?.is_suspended
                ? `Restore access for ${confirmBlock?.full_name || confirmBlock?.email}.`
                : `Revoke access for ${confirmBlock?.full_name || confirmBlock?.email}. They will be signed out immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmBlock) return;
                try {
                  await callFn("set_suspended", {
                    user_id: confirmBlock.user_id,
                    is_suspended: !confirmBlock.is_suspended,
                  });
                  toast.success(confirmBlock.is_suspended ? "Admin unblocked" : "Admin blocked");
                  setConfirmBlock(null);
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              {confirmBlock?.is_suspended ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete {confirmDelete?.full_name || confirmDelete?.email}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await callFn("delete", { user_id: confirmDelete.user_id });
                  toast.success("Admin deleted");
                  setConfirmDelete(null);
                  load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CreateAdminDialog = ({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) => {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setPassword(""); setCreated(null); setCopied(false);
    }
  }, [open]);

  const submit = async () => {
    if (!email || !password || password.length < 8 || !full_name) {
      toast.error("Name, email, and 8+ char password required");
      return;
    }
    setBusy(true);
    try {
      const res = await callFn("create", { full_name, email, phone: phone || null, password });
      setCreated({ email: res.email, password: res.password });
      toast.success("Admin created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Admin credentials" : "Add new admin"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share these credentials securely. The admin will be asked to change their password on first login.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div><span className="font-semibold">Email:</span> {created.email}</div>
              <div><span className="font-semibold">Password:</span> <code>{created.password}</code></div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
            <DialogFooter>
              <Button onClick={onCreated}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={full_name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Initial password (min 8 chars)</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                The admin will be required to change this on first login.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create admin
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const EditAdminDialog = ({ admin, onClose, onSaved }: {
  admin: AdminRow | null; onClose: () => void; onSaved: () => void;
}) => {
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (admin) {
      setName(admin.full_name || "");
      setPhone(admin.phone || "");
      setPassword("");
    }
  }, [admin]);

  if (!admin) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: admin.user_id,
        full_name,
        phone,
      };
      if (password) {
        if (password.length < 8) {
          toast.error("Password must be 8+ chars");
          setBusy(false);
          return;
        }
        payload.password = password;
      }
      await callFn("update", payload);
      toast.success("Admin updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!admin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit admin · {admin.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input value={full_name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Reset password (optional)</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password" />
            <p className="text-xs text-muted-foreground mt-1">
              If set, admin will be forced to change it on next login.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAdminsPage;
