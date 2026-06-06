/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from "react"; import { useNavigate } from "react-router-dom";
import { Search, Download, ChevronLeft, ChevronRight, Loader2, GraduationCap, RefreshCw, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useExams } from "@/hooks/useExams";

type StudentRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  target_exam: string | null;
  class_level: string | null;
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
    "Name", "Email", "Phone", "Target Exam", "Class",
    "City", "Country", "Onboarding", "Suspended", "Joined",
  ];
  const lines = rows.map((u) =>
    [
      u.full_name ?? "", u.email ?? "", u.phone ?? "",
      u.target_exam ?? "", u.class_level ?? "",
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

const AdminStudentsPage = () => {
  const navigate = useNavigate();
  const { examNames } = useExams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [schools, setSchools] = useState<SchoolLite[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string>("");

  // Add Student modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    target_exam: "", class_level: "", city: "", country: ""
  });
  const [addSaving, setAddSaving] = useState(false);

  // 300ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("schools").select("id, name").order("name");
      setSchools((data as SchoolLite[]) ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
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
          "user_id, full_name, phone, avatar_url, country, city, target_exam, class_level, is_suspended, onboarding_completed, doubt_preference, created_at, school_id",
          { count: "exact" },
        )
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`full_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%,target_exam.ilike.%${debouncedSearch}%`);
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
  }, [debouncedSearch, page, schoolFilter, schools]);

  useEffect(() => { load(); }, [load]);

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

  const handleAddStudent = async () => {
    if (!addForm.email.trim()) return toast.error("Email is required");
    if (!addForm.password || addForm.password.length < 6) return toast.error("Password must be at least 6 characters");
    setAddSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-student", {
        body: { action: "create", ...addForm },
      });
      if (error) throw error;
      const newUserId: string | undefined = data?.user_id;
      toast.success(`Student ${addForm.full_name || addForm.email} added`);
      setAddOpen(false);
      setAddForm({ full_name: "", email: "", phone: "", password: "", target_exam: "", class_level: "", city: "", country: "" });
      if (newUserId) {
        navigate(`/admin/students/${newUserId}`);
      } else {
        load();
      }
    } catch (e: any) {
      toast.error("Failed to add student", { description: e.message });
    } finally {
      setAddSaving(false);
    }
  };

  const exportSelected = () => {
    const target = selected.length ? rows.filter((r) => selected.includes(r.user_id)) : rows;
    if (!target.length) return toast.error("Nothing to export");
    exportCsv(target);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      {/* Header */}
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-muted/50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={exportSelected}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-muted/50"
          >
            <Download className="h-3.5 w-3.5" />
            Export {selected.length ? `(${selected.length})` : "All"}
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-xs font-semibold text-primary-foreground cursor-pointer transition-opacity hover:opacity-90"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, city, or target exam..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={schoolFilter}
          onChange={(e) => { setSchoolFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-border bg-background py-2 px-3 text-sm outline-none focus:border-primary transition-colors"
        >
          <option value="">All schools</option>
          <option value="none">Not associated</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Bulk selection bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 flex-wrap">
          <span className="text-xs font-medium text-foreground">{selected.length} selected</span>
          <button
            onClick={() => exportCsv(rows.filter((r) => selected.includes(r.user_id)))}
            className="rounded-lg bg-background border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground flex items-center gap-1 cursor-pointer"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
          <button
            onClick={() => setSelected([])}
            className="rounded-lg bg-background border border-border px-3 py-1 text-[10px] font-medium text-muted-foreground cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
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
                <th className="p-3 text-left font-medium hidden xl:table-cell">Joined</th>
                <th className="p-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-muted-foreground">No students found.</td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => navigate(`/admin/students/${u.user_id}`)}
                    className="border-b border-border hover:bg-background/50 cursor-pointer transition-colors"
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages} · {rows.length} of {total}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{page + 1}</span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border p-2 text-muted-foreground disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Add Student Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !addSaving && setAddOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Add New Student</h2>
              </div>
              <button onClick={() => setAddOpen(false)} disabled={addSaving} className="cursor-pointer">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Account */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Account</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Full Name</label>
                    <input
                      value={addForm.full_name}
                      onChange={(e) => setAddForm((s) => ({ ...s, full_name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Phone</label>
                    <input
                      value={addForm.phone}
                      onChange={(e) => setAddForm((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Email <span className="text-destructive">*</span></label>
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="student@example.com"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Password <span className="text-destructive">*</span></label>
                    <input
                      type="password"
                      value={addForm.password}
                      onChange={(e) => setAddForm((s) => ({ ...s, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Profile</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Target Exam</label>
                    <select
                      value={addForm.target_exam}
                      onChange={(e) => setAddForm((s) => ({ ...s, target_exam: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    >
                      <option value="">— Select exam —</option>
                      {examNames.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  {[
                    { key: "class_level", label: "Class Level", placeholder: "e.g. 11, 12" },
                    { key: "city", label: "City", placeholder: "e.g. Mumbai" },
                    { key: "country", label: "Country", placeholder: "e.g. India" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-[10px] font-medium text-muted-foreground">{f.label}</label>
                      <input
                        value={(addForm as any)[f.key]}
                        onChange={(e) => setAddForm((s) => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                disabled={addSaving}
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={addSaving}
                onClick={handleAddStudent}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60 cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {addSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                Add Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentsPage;
