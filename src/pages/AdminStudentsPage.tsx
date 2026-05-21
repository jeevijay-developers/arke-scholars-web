/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, Download, X, ChevronLeft, ChevronRight, Loader2, Trash2, Save, Mail, GraduationCap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type StudentRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  target_exam: string | null;
  class_level: string | null;
  goal: string | null;
  plan: string;
  is_suspended: boolean;
  onboarding_completed: boolean;
  doubt_preference: string;
  created_at: string;
  email?: string | null;
  school_id?: string | null;
  school_name?: string | null;
};

type SchoolLite = { id: string; name: string };

const PAGE_SIZE = 25;

const exportCsv = (rows: StudentRow[]) => {
  const header = [
    "Name", "Email", "Phone", "Plan", "Target Exam", "Class", "Goal",
    "City", "Country", "Onboarding", "Suspended", "Joined",
  ];
  const lines = rows.map((u) =>
    [
      u.full_name ?? "", u.email ?? "", u.phone ?? "", u.plan,
      u.target_exam ?? "", u.class_level ?? "", u.goal ?? "",
      u.city ?? "", u.country ?? "",
      u.onboarding_completed ? "Yes" : "No",
      u.is_suspended ? "Yes" : "No",
      new Date(u.created_at).toISOString(),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const PLAN_OPTIONS = ["Free", "Pro", "Elite"];

const AdminStudentsPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<StudentRow | null>(null);
  const [edit, setEdit] = useState<Partial<StudentRow>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StudentRow | null>(null);
  const [schools, setSchools] = useState<SchoolLite[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string>(""); // "", "none", or school id

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("schools").select("id, name").order("name");
      setSchools((data as SchoolLite[]) ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get only student user_ids first
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (rErr) throw rErr;
      const studentIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (!studentIds.length) {
        setRows([]); setTotal(0); setLoading(false); return;
      }

      let query = (supabase as any)
        .from("profiles")
        .select(
          "user_id, full_name, phone, avatar_url, country, city, target_exam, class_level, goal, plan, is_suspended, onboarding_completed, doubt_preference, created_at, school_id",
          { count: "exact" },
        )
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });

      if (search.trim()) {
        const s = search.trim();
        query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,target_exam.ilike.%${s}%`);
      }
      if (schoolFilter === "none") query = query.is("school_id", null);
      else if (schoolFilter) query = query.eq("school_id", schoolFilter);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      const baseRows = (data ?? []) as StudentRow[];
      const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
      baseRows.forEach((r) => { r.school_name = r.school_id ? schoolMap.get(r.school_id) ?? null : null; });

      // Fetch emails via edge function for visible rows
      let emails: Record<string, string | null> = {};
      if (baseRows.length) {
        const { data: emailData } = await supabase.functions.invoke("manage-student", {
          body: { action: "get_emails", user_ids: baseRows.map((r) => r.user_id) },
        });
        emails = emailData?.emails ?? {};
      }
      setRows(baseRows.map((r) => ({ ...r, email: emails[r.user_id] ?? null })));
      setTotal(count ?? 0);
    } catch (e: any) {
      toast.error("Failed to load students", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [search, page, schoolFilter, schools]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh when profiles or roles change
  useEffect(() => {
    const ch = supabase
      .channel("admin-students-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = useMemo(() => rows.length > 0 && rows.every((r) => selected.includes(r.user_id)), [rows, selected]);

  const openDrawer = (u: StudentRow) => {
    setDrawer(u);
    setEdit({
      full_name: u.full_name ?? "",
      phone: u.phone ?? "",
      target_exam: u.target_exam ?? "",
      class_level: u.class_level ?? "",
      city: u.city ?? "",
      country: u.country ?? "",
      goal: u.goal ?? "",
      plan: u.plan,
    });
  };

  const saveEdit = async () => {
    if (!drawer) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: { action: "update", user_id: drawer.user_id, ...edit },
      });
      if (error) throw error;
      toast.success("Student updated");
      setDrawer(null);
      load();
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async (u: StudentRow) => {
    const { error } = await supabase.from("profiles").update({ is_suspended: !u.is_suspended }).eq("user_id", u.user_id);
    if (error) return toast.error(error.message);
    toast.success(u.is_suspended ? "Student unsuspended" : "Student suspended");
    setDrawer(null);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: { action: "delete", user_id: confirmDelete.user_id },
      });
      if (error) throw error;
      toast.success("Student deleted");
      setConfirmDelete(null);
      setDrawer(null);
      setSelected((s) => s.filter((id) => id !== confirmDelete.user_id));
      load();
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const exportSelected = () => {
    const target = selected.length ? rows.filter((r) => selected.includes(r.user_id)) : rows;
    if (!target.length) return toast.error("Nothing to export");
    exportCsv(target);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Students</h1>
            <p className="text-xs text-muted-foreground">{total} total · live data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={exportSelected}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Export {selected.length ? `(${selected.length})` : "All"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone, city, or target exam..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={schoolFilter}
          onChange={(e) => { setSchoolFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-border bg-background py-2 px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">All schools</option>
          <option value="none">Not associated</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
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
            onClick={() => setSelected([])}
            className="rounded-lg bg-background border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground"
          >
            Clear
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in-up">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((u) => u.user_id) : [])}
                  />
                </th>
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium hidden md:table-cell">Email</th>
                <th className="p-3 text-left font-medium hidden sm:table-cell">Phone</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Target Exam</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Class</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">School</th>
                <th className="p-3 text-left font-medium">Plan</th>
                <th className="p-3 text-left font-medium hidden xl:table-cell">Joined</th>
                <th className="p-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-muted-foreground">No students found.</td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => openDrawer(u)}
                    className="border-b border-border hover:bg-background/50 cursor-pointer"
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selected.includes(u.user_id)}
                        onChange={(e) =>
                          setSelected(e.target.checked ? [...selected, u.user_id] : selected.filter((id) => id !== u.user_id))
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-[10px] font-bold text-primary shrink-0 overflow-hidden">
                          {u.avatar_url?.trim() ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.parentElement as HTMLElement).innerText =
                                  (u.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2);
                              }}
                            />
                          ) : (
                            (u.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2)
                          )}
                        </div>
                        <span className="font-medium text-foreground truncate">{u.full_name || "Unnamed"}</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground truncate max-w-[200px]">{u.email || "—"}</td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground">{u.phone || "—"}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{u.target_exam || "—"}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{u.class_level || "—"}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{u.school_name || "—"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">{u.plan}</span>
                    </td>
                    <td className="p-3 hidden xl:table-cell text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      {u.is_suspended ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase">Suspended</span>
                      ) : (
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">Active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(null)} />
          <div className="relative w-full max-w-md bg-card shadow-xl border-l border-border overflow-y-auto animate-slide-in-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Student Details</h2>
              <button onClick={() => setDrawer(null)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-lg font-bold text-primary overflow-hidden">
                  {drawer.avatar_url?.trim() ? (
                    <img
                      src={drawer.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        (e.currentTarget.parentElement as HTMLElement).innerText =
                          (drawer.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2);
                      }}
                    />
                  ) : (
                    (drawer.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{drawer.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {drawer.email || "No email"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { key: "full_name", label: "Full name" },
                  { key: "phone", label: "Phone" },
                  { key: "target_exam", label: "Target exam" },
                  { key: "class_level", label: "Class level" },
                  { key: "city", label: "City" },
                  { key: "country", label: "Country" },
                  { key: "goal", label: "Goal" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{f.label}</label>
                    <input
                      value={(edit as any)[f.key] ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Plan</label>
                  <select
                    value={edit.plan ?? "Free"}
                    onChange={(e) => setEdit((s) => ({ ...s, plan: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  >
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background/50 p-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Joined</p>
                  <p className="text-xs font-medium text-foreground">{new Date(drawer.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Onboarding</p>
                  <p className="text-xs font-medium text-foreground">{drawer.onboarding_completed ? "Done" : "Pending"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Doubt routing</p>
                  <p className="text-xs font-medium text-foreground capitalize">{drawer.doubt_preference}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                  <p className={`text-xs font-medium ${drawer.is_suspended ? "text-destructive" : "text-secondary"}`}>
                    {drawer.is_suspended ? "Suspended" : "Active"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save changes
                </button>
                <button
                  onClick={() => toggleSuspend(drawer)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-medium ${
                    drawer.is_suspended ? "border-secondary/30 text-secondary" : "border-destructive/30 text-destructive"
                  }`}
                >
                  {drawer.is_suspended ? "Unsuspend student" : "Suspend student"}
                </button>
                <button
                  onClick={() => setConfirmDelete(drawer)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> Delete student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 border border-border shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">Delete student permanently?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This will permanently delete <span className="font-semibold text-foreground">{confirmDelete.full_name || "this student"}</span> and all their data (profile, progress, attempts, enrollments). This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={doDelete}
                className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentsPage;
