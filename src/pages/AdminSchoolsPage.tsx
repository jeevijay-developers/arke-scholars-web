import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { School, Plus, Edit3, Trash2, Loader2, X, Upload, Users, ChevronRight, Copy, Download, FileText } from "lucide-react";

type SchoolRow = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string | null;
  board: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  student_count?: number;
};

type Draft = Partial<SchoolRow> & { name: string };
const empty: Draft = { name: "", board: "CBSE", is_active: true };

const BOARDS = ["CBSE", "ICSE", "IB", "CBSE-i", "State Board", "Other"];

const generateSchoolCode = (name: string): string => {
  const cleaned = (name || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/).filter(Boolean);
  let prefix = "";
  if (words.length >= 2) {
    prefix = words.slice(0, 4).map((w) => w[0]).join("");
  } else {
    prefix = words[0].slice(0, 4);
  }
  prefix = prefix.slice(0, 5).padEnd(3, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${suffix}`;
};

type CsvRow = { full_name?: string; email?: string; phone?: string; class_level?: string; target_exam?: string; city?: string };
type ResultRow = { email: string | null; status: string; error?: string; temp_password?: string | null };

const AdminSchoolsPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [students, setStudents] = useState<Array<{ user_id: string; full_name: string | null; class_level: string | null; target_exam: string | null }>>([]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const CSV_TEMPLATE = "full_name,email,phone,class_level,target_exam,city\nAarav Sharma,aarav@example.com,9999999999,12,JEE Main,Delhi\nIsha Verma,isha@example.com,9888888888,11,NEET,Mumbai\n";

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "school-students-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      return toast.error("Please select a .csv file");
    }
    if (file.size > 5 * 1024 * 1024) return toast.error("File too large (max 5MB)");
    const text = await file.text();
    setCsvText(text);
    setCsvFileName(file.name);
  };

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("schools").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list: SchoolRow[] = data ?? [];

    if (list.length) {
      const ids = list.map((s) => s.id);
      const { data: counts } = await (supabase as any)
        .from("profiles").select("school_id").in("school_id", ids);
      const map = new Map<string, number>();
      (counts ?? []).forEach((r: any) => map.set(r.school_id, (map.get(r.school_id) ?? 0) + 1));
      list.forEach((s) => (s.student_count = map.get(s.id) ?? 0));
    }
    setSchools(list);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const loadStudents = async (s: SchoolRow) => {
    setSelected(s);
    setStudents([]);
    const { data } = await (supabase as any)
      .from("profiles").select("user_id, full_name, class_level, target_exam")
      .eq("school_id", s.id).order("full_name", { ascending: true });
    setStudents(data ?? []);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload: any = {
      name: editing.name.trim(),
      code: editing.code?.trim() || (editing.id ? null : generateSchoolCode(editing.name)),
      city: editing.city?.trim() || null,
      country: editing.country?.trim() || null,
      board: editing.board || null,
      contact_person: editing.contact_person?.trim() || null,
      contact_email: editing.contact_email?.trim() || null,
      contact_phone: editing.contact_phone?.trim() || null,
      address: editing.address?.trim() || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("schools").update(payload).eq("id", editing.id)
      : await (supabase as any).from("schools").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "School updated" : "School created");
    setEditing(null);
    reload();
  };

  const remove = async (s: SchoolRow) => {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      description: "Students will keep their accounts but will be unlinked from this school. This action cannot be undone.",
      confirmLabel: "Delete school",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("schools").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: CsvRow = {};
      headers.forEach((h, i) => {
        const v = cells[i] ?? "";
        if (!v) return;
        if (["full_name", "email", "phone", "class_level", "target_exam", "city"].includes(h)) {
          (row as any)[h] = v;
        }
      });
      return row;
    }).filter((r) => r.email);
  };

  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);

  const upload = async () => {
    if (!selected) return;
    if (!parsedRows.length) return toast.error("No valid rows. Header must include 'email'.");
    setUploading(true);
    setResults(null);
    const { data, error } = await supabase.functions.invoke("bulk-onboard-school-students", {
      body: { school_id: selected.id, rows: parsedRows },
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    setResults((data as any)?.results ?? []);
    const s = (data as any)?.summary;
    toast.success(`${s?.created ?? 0} created · ${s?.linked_existing ?? 0} linked · ${s?.errors ?? 0} errors`);
    loadStudents(selected);
  };

  const filtered = schools.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <School className="h-5 w-5 text-primary" /> Schools
          </h1>
          <p className="text-sm text-muted-foreground">Add partner schools and bulk-onboard their students.</p>
        </div>
        <button onClick={() => setEditing({ ...empty })}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> New School
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…"
        className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm" />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">City</th>
                <th className="px-3 py-2 font-semibold">Board</th>
                <th className="px-3 py-2 font-semibold">Students</th>
                <th className="px-3 py-2 font-semibold w-24">Status</th>
                <th className="px-3 py-2 w-40" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-bold text-foreground">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.code || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.city || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.board || "—"}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-semibold"><Users className="h-3 w-3" />{s.student_count ?? 0}</span></td>
                  <td className="px-3 py-2">{s.is_active ? <span className="text-secondary font-bold">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => loadStudents(s)} className="p-1 hover:bg-muted rounded" title="View students"><ChevronRight className="h-4 w-4" /></button>
                    <button onClick={() => setEditing({ ...s })} className="p-1 hover:bg-muted rounded ml-1"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => remove(s)} className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No schools yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl shadow-xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? "Edit School" : "New School"}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <Field label="Name *">
              <Input
                v={editing.name}
                on={(v) => {
                  const next: Draft = { ...editing, name: v };
                  if (!editing.id && !editing.code?.trim()) {
                    next.code = generateSchoolCode(v);
                  }
                  setEditing(next);
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code (auto-generated)">
                <div className="flex items-center gap-1">
                  <input
                    value={editing.code ?? ""}
                    readOnly
                    className="sch-input flex-1 bg-muted/40 font-mono text-xs"
                    placeholder="Auto from name"
                  />
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, code: generateSchoolCode(editing.name || "SCH") })}
                    title="Regenerate code"
                    className="rounded-md border border-border bg-background px-2 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    ↻
                  </button>
                </div>
              </Field>
              <Field label="Board">
                <select value={editing.board ?? ""} onChange={(e) => setEditing({ ...editing, board: e.target.value })} className="sch-input">
                  <option value="">—</option>
                  {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="City"><Input v={editing.city ?? ""} on={(v) => setEditing({ ...editing, city: v })} /></Field>
              <Field label="Country"><Input v={editing.country ?? ""} on={(v) => setEditing({ ...editing, country: v })} /></Field>
            </div>
            <Field label="Contact person"><Input v={editing.contact_person ?? ""} on={(v) => setEditing({ ...editing, contact_person: v })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact email"><Input v={editing.contact_email ?? ""} on={(v) => setEditing({ ...editing, contact_email: v })} /></Field>
              <Field label="Contact phone"><Input v={editing.contact_phone ?? ""} on={(v) => setEditing({ ...editing, contact_phone: v })} /></Field>
            </div>
            <Field label="Address">
              <textarea rows={2} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className="sch-input" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-black/50 flex justify-end" onClick={() => { setSelected(null); setResults(null); setCsvOpen(false); setCsvText(""); setCsvFileName(null); }}>
          <div className="bg-card w-full max-w-2xl h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">{selected.city || "—"} · {selected.board || "—"}</p>
              </div>
              <button onClick={() => { setSelected(null); setResults(null); setCsvOpen(false); setCsvText(""); setCsvFileName(null); }} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setCsvOpen((v) => !v)} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground inline-flex items-center gap-1">
                <Upload className="h-4 w-4" /> Bulk upload students
              </button>
              <button onClick={downloadTemplate} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold inline-flex items-center gap-1 hover:bg-muted">
                <Download className="h-4 w-4" /> Download CSV template
              </button>
              <span className="text-sm text-muted-foreground">{students.length} student{students.length === 1 ? "" : "s"} associated</span>
            </div>

            {csvOpen && (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
                    Upload a <code>.csv</code> file with header row. Columns: <code>full_name, email, phone, class_level, target_exam, city</code>. Email is required. Need a starting point? Download the template above.
                  </p>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background hover:bg-muted/50 cursor-pointer py-6 px-4 transition-colors">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {csvFileName ? "Replace file" : "Click to choose CSV file"}
                  </span>
                  <span className="text-xs text-muted-foreground">.csv up to 5MB</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                {csvFileName && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate font-semibold">{csvFileName}</span>
                    </span>
                    <button
                      onClick={() => { setCsvText(""); setCsvFileName(null); setResults(null); }}
                      className="p-1 hover:bg-muted rounded text-muted-foreground"
                      title="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {csvText && (
                  <details className="rounded-md border border-border bg-background">
                    <summary className="px-3 py-2 text-xs font-semibold cursor-pointer">Preview parsed CSV</summary>
                    <pre className="px-3 pb-3 text-[10px] font-mono overflow-x-auto max-h-40 text-muted-foreground">{csvText.slice(0, 2000)}{csvText.length > 2000 ? "\n…" : ""}</pre>
                  </details>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{parsedRows.length} valid row{parsedRows.length === 1 ? "" : "s"} parsed</span>
                  <button onClick={upload} disabled={uploading || !parsedRows.length}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                    {uploading ? "Onboarding..." : `Onboard ${parsedRows.length}`}
                  </button>
                </div>
              </div>
            )}

            {results && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted text-xs font-bold uppercase tracking-wider">Onboarding results</div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr><th className="px-2 py-1 text-left">Email</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Temp password / Error</th></tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">{r.email}</td>
                        <td className={`px-2 py-1 font-semibold ${r.status === "error" ? "text-destructive" : r.status === "created" ? "text-secondary" : "text-foreground"}`}>{r.status}</td>
                        <td className="px-2 py-1">
                          {r.error ?? (r.temp_password ? (
                            <span className="inline-flex items-center gap-1 font-mono">
                              {r.temp_password}
                              <button onClick={() => { navigator.clipboard.writeText(r.temp_password!); toast.success("Copied"); }} className="p-0.5 hover:bg-muted rounded"><Copy className="h-3 w-3" /></button>
                            </span>
                          ) : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted text-xs font-bold uppercase tracking-wider">Students</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr className="text-left"><th className="px-2 py-1">Name</th><th className="px-2 py-1">Class</th><th className="px-2 py-1">Target Exam</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.user_id} className="border-t border-border">
                      <td className="px-2 py-1">{s.full_name || "—"}</td>
                      <td className="px-2 py-1 text-muted-foreground">{s.class_level || "—"}</td>
                      <td className="px-2 py-1 text-muted-foreground">{s.target_exam || "—"}</td>
                    </tr>
                  ))}
                  {students.length === 0 && <tr><td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">No students yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`.sch-input { width: 100%; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .sch-input:focus { border-color: hsl(var(--primary)); }`}</style>
      {ConfirmDialog}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

const Input = ({ v, on }: { v: string | undefined | null; on: (s: string) => void }) => (
  <input value={v ?? ""} onChange={(e) => on(e.target.value)} className="sch-input" />
);

export default AdminSchoolsPage;
