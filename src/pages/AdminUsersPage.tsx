import { useMemo, useState, useCallback } from "react";
import { Search, UserPlus, Download, X, ChevronLeft, ChevronRight, Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { List, type RowComponentProps } from "react-window";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, type AdminUserRow } from "@/hooks/useAdminUsers";

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    student: "bg-secondary/10 text-secondary",
    teacher: "bg-primary/10 text-primary",
    mentor: "bg-secondary/15 text-secondary",
    admin: "bg-accent/20 text-accent",
    super_admin: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${styles[role] ?? styles.student}`}>{role.replace("_", " ")}</span>;
};

const planBadge = (plan: string) => {
  const styles: Record<string, string> = { Free: "bg-muted text-muted-foreground", Pro: "bg-primary/10 text-primary", Elite: "bg-accent/20 text-accent" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[plan] ?? styles.Free}`}>{plan}</span>;
};

const exportCsv = (rows: AdminUserRow[]) => {
  const header = ["Name", "Phone", "Role", "Plan", "Country", "Target Exam", "Suspended", "Joined"];
  const lines = rows.map((u) =>
    [u.full_name ?? "", u.phone ?? "", u.role, u.plan, u.country ?? "", u.target_exam ?? "", u.is_suspended ? "Yes" : "No", new Date(u.created_at).toISOString()]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ROLE_DESCRIPTIONS: Record<AdminUserRow["role"], string> = {
  student: "Can access their own dashboard, courses, tests, and progress only.",
  teacher: "Goes live on scheduled classes, uploads notes PDFs, and resolves doubts assigned to their courses.",
  mentor: "Chats 1:1 and in groups with assigned students; views their performance read-only.",
  admin: "Manages courses, live classes, mentors, students, and content moderation.",
  super_admin: "Highest privilege — everything admin can do, plus revenue, refunds, platform settings and admin account creation.",
};

type UserRowProps = {
  rows: AdminUserRow[];
  selected: string[];
  setSelected: (s: string[]) => void;
  onRowClick: (u: AdminUserRow) => void;
};

const UserListRow = ({
  index,
  style,
  rows,
  selected,
  setSelected,
  onRowClick,
}: RowComponentProps<UserRowProps>) => {
  const u = rows[index];
  if (!u) return null;
  const isChecked = selected.includes(u.user_id);
  return (
    <div
      style={style}
      onClick={() => onRowClick(u)}
      className="flex items-center border-b border-border hover:bg-background/50 cursor-pointer text-xs"
    >
      <div className="p-3 w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="rounded"
          checked={isChecked}
          onChange={(e) =>
            setSelected(e.target.checked ? [...selected, u.user_id] : selected.filter((id) => id !== u.user_id))
          }
        />
      </div>
      <div className="p-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-[10px] font-bold text-primary shrink-0 overflow-hidden">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              (u.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2)
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{u.full_name || "Unnamed user"}</p>
            {u.is_suspended && <span className="text-[9px] font-bold text-destructive uppercase">Suspended</span>}
          </div>
        </div>
      </div>
      <div className="p-3 w-32 hidden sm:block text-muted-foreground truncate">{u.phone || "—"}</div>
      <div className="p-3 w-28">{roleBadge(u.role)}</div>
      <div className="p-3 w-20 hidden md:block">{planBadge(u.plan)}</div>
      <div className="p-3 w-28 hidden lg:block text-muted-foreground truncate">{u.country || "—"}</div>
      <div className="p-3 w-24 hidden lg:block text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
      <div className="p-3 w-12 text-muted-foreground">
        {u.is_suspended ? <ShieldOff className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-secondary" />}
      </div>
    </div>
  );
};

const UsersVirtualTable = ({
  rows,
  loading,
  selected,
  setSelected,
  allSelected,
  onRowClick,
}: {
  rows: AdminUserRow[];
  loading: boolean;
  selected: string[];
  setSelected: (s: string[]) => void;
  allSelected: boolean;
  onRowClick: (u: AdminUserRow) => void;
}) => {
  const rowProps = useMemo(
    () => ({ rows, selected, setSelected, onRowClick }),
    [rows, selected, setSelected, onRowClick],
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in-up">
      <div className="flex items-center border-b border-border bg-background text-xs font-medium text-muted-foreground">
        <div className="p-3 w-10 shrink-0">
          <input
            type="checkbox"
            className="rounded"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? rows.map((u) => u.user_id) : [])}
          />
        </div>
        <div className="p-3 flex-1">Name</div>
        <div className="p-3 w-32 hidden sm:block">Phone</div>
        <div className="p-3 w-28">Role</div>
        <div className="p-3 w-20 hidden md:block">Plan</div>
        <div className="p-3 w-28 hidden lg:block">Country</div>
        <div className="p-3 w-24 hidden lg:block">Joined</div>
        <div className="p-3 w-12"></div>
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">No users match your filters.</div>
      ) : (
        <List
          rowCount={rows.length}
          rowHeight={56}
          rowComponent={UserListRow}
          rowProps={rowProps}
          style={{ height: Math.min(rows.length * 56 + 4, 600) }}
          overscanCount={6}
        />
      )}
    </div>
  );
};

const AdminUsersPage = () => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerUser, setDrawerUser] = useState<AdminUserRow | null>(null);
  const [bulkBody, setBulkBody] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [pendingRole, setPendingRole] = useState<AdminUserRow["role"] | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const { rows, total, loading, pageSize, reload } = useAdminUsers(filter, search, page);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelected = useMemo(() => rows.length > 0 && rows.every((r) => selected.includes(r.user_id)), [rows, selected]);

  const toggleSuspend = async (u: AdminUserRow) => {
    const { error } = await supabase.from("profiles").update({ is_suspended: !u.is_suspended }).eq("user_id", u.user_id);
    if (error) return toast.error(error.message);
    toast.success(u.is_suspended ? "User unsuspended" : "User suspended");
    setDrawerUser(null);
    reload();
  };

  const confirmChangeRole = async () => {
    if (!drawerUser || !pendingRole) return;
    setSavingRole(true);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _user_id: drawerUser.user_id,
      _role: pendingRole,
    });
    setSavingRole(false);
    if (error) {
      toast.error("Could not update role", { description: error.message });
      return;
    }
    toast.success(`Role updated to ${pendingRole}`);
    setPendingRole(null);
    setDrawerUser(null);
    reload();
  };

  const sendBulkNotification = async () => {
    if (!bulkBody.trim()) return toast.error("Enter a message");
    const inserts = selected.map((uid) => ({ user_id: uid, title: "Update from Arke", body: bulkBody, type: "system" as const }));
    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${selected.length} user${selected.length === 1 ? "" : "s"}`);
    setShowBulk(false);
    setBulkBody("");
    setSelected([]);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
        <div>
          <h1 className="text-lg font-bold text-foreground">Users</h1>
          <p className="text-xs text-muted-foreground">{total} total · live data</p>
        </div>
        <button
          onClick={() => toast.info("Invite flow coming soon")}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite User
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or phone..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "student", "teacher", "mentor", "admin", "super_admin"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className={`rounded-lg px-3 py-2 text-xs font-medium capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "super_admin" ? "Super Admins" : `${f}s`}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 flex-wrap">
          <span className="text-xs font-medium text-foreground">{selected.length} selected</span>
          <button
            onClick={() => exportCsv(rows.filter((r) => selected.includes(r.user_id)))}
            className="rounded-lg bg-background border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className="rounded-lg bg-background border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground"
          >
            Send Notification
          </button>
        </div>
      )}

      <UsersVirtualTable
        rows={rows}
        loading={loading}
        selected={selected}
        setSelected={setSelected}
        allSelected={allSelected}
        onRowClick={setDrawerUser}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages} · {rows.length} of {total}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{page + 1}</span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {drawerUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerUser(null)} />
          <div className="relative w-full max-w-sm bg-card shadow-xl border-l border-border overflow-y-auto animate-slide-in-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">User Details</h2>
              <button onClick={() => setDrawerUser(null)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-lg font-bold text-primary overflow-hidden">
                  {drawerUser.avatar_url ? (
                    <img src={drawerUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (drawerUser.full_name ?? "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{drawerUser.full_name || "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground truncate">{drawerUser.phone || "No phone"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Role", value: drawerUser.role },
                  { label: "Plan", value: drawerUser.plan },
                  { label: "Target exam", value: drawerUser.target_exam ?? "—" },
                  { label: "Country", value: drawerUser.country ?? "—" },
                  { label: "City", value: drawerUser.city ?? "—" },
                  { label: "Joined", value: new Date(drawerUser.created_at).toLocaleDateString() },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] text-muted-foreground uppercase">{f.label}</p>
                    <p className="text-xs font-medium text-foreground capitalize">{f.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Role &amp; access</p>
                  {roleBadge(drawerUser.role)}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  {ROLE_DESCRIPTIONS[drawerUser.role]}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Change role to</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["student", "teacher", "mentor", "admin", "super_admin"] as const).map((r) => {
                    const isCurrent = drawerUser.role === r;
                    const label = r === "super_admin" ? "Super Admin" : r;
                    return (
                      <button
                        key={r}
                        onClick={() => setPendingRole(r)}
                        disabled={isCurrent}
                        className={`rounded-lg border px-3 py-2 text-[11px] font-semibold capitalize transition-colors ${
                          isCurrent
                            ? "border-primary/30 bg-primary/5 text-primary cursor-not-allowed"
                            : "border-border text-foreground hover:bg-muted/40"
                        }`}
                      >
                        {isCurrent ? `${label} (current)` : label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => toggleSuspend(drawerUser)}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-medium ${
                  drawerUser.is_suspended ? "border-secondary/30 text-secondary" : "border-destructive/30 text-destructive"
                }`}
              >
                {drawerUser.is_suspended ? "Unsuspend user" : "Suspend user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRole && drawerUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !savingRole && setPendingRole(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 border border-border shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Confirm role change</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Change <span className="font-semibold text-foreground">{drawerUser.full_name || "this user"}</span>'s
                  role from <span className="capitalize font-semibold text-foreground">{drawerUser.role}</span> to{" "}
                  <span className="capitalize font-semibold text-primary">{pendingRole}</span>?
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground capitalize mb-1">{pendingRole} access</p>
              {ROLE_DESCRIPTIONS[pendingRole]}
            </div>
            {(pendingRole === "admin" || pendingRole === "super_admin") && drawerUser.role === "student" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
                <strong>Heads up:</strong> Granting {pendingRole.replace("_", " ")} access removes student-portal access for this user. They will be redirected to the admin dashboard on their next sign-in.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                disabled={savingRole}
                onClick={() => setPendingRole(null)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={savingRole}
                onClick={confirmChangeRole}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {savingRole && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBulk(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 border border-border shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-foreground">Send notification to {selected.length} users</h2>
            <textarea
              value={bulkBody}
              onChange={(e) => setBulkBody(e.target.value)}
              rows={4}
              placeholder="Type your announcement..."
              className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBulk(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                Cancel
              </button>
              <button onClick={sendBulkNotification} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
