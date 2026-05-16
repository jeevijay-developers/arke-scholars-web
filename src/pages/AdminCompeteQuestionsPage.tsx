import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Loader2, Swords, Search, CheckSquare, Square, Filter, EyeOff, Eye, X, Upload } from "lucide-react";
import BulkQuestionUploadDialog from "@/components/BulkQuestionUploadDialog";
import MathRenderer from "@/components/MathRenderer";
import { useExams } from "@/hooks/useExams";
import TablePagination from "@/components/TablePagination";

type Q = {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  target_exam?: string | null;
  class_level?: string | null;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  is_active: boolean;
};

import { SUBJECTS_COMPETE } from "@/lib/constants";
const SUBJECTS: string[] = [...SUBJECTS_COMPETE];
const DIFFICULTIES = ["easy", "medium", "hard"];
// EXAMS now sourced from useExams() (DB-managed). Fallback handled by the hook.
const CLASS_LEVELS = ["9", "10", "11", "12", "Dropper"];

const empty: Omit<Q, "id"> = {
  subject: "Physics",
  topic: "Kinematics",
  difficulty: "medium",
  target_exam: "JEE Main",
  class_level: "11",
  question_text: "",
  options: ["", "", "", ""],
  correct_index: 0,
  explanation: "",
  is_active: true,
};

const PAGE_SIZE = 20;

const AdminCompeteQuestionsPage = () => {
  const { examNames: EXAMS } = useExams();
  const [list, setList] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Omit<Q, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fSubject, setFSubject] = useState<string>("");
  const [fDifficulty, setFDifficulty] = useState<string>("");
  const [fExam, setFExam] = useState<string>("");
  const [fClass, setFClass] = useState<string>("");
  const [fActive, setFActive] = useState<string>("");

  // Server-side pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, fSubject, fDifficulty, fExam, fClass, fActive]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("compete_questions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (fSubject) q = q.eq("subject", fSubject);
    if (fDifficulty) q = q.eq("difficulty", fDifficulty);
    if (fExam) q = q.eq("target_exam", fExam);
    if (fClass) q = q.eq("class_level", fClass);
    if (fActive === "active") q = q.eq("is_active", true);
    if (fActive === "inactive") q = q.eq("is_active", false);
    if (debouncedSearch) {
      const escaped = debouncedSearch.replace(/[%,()]/g, " ");
      q = q.or(`question_text.ilike.%${escaped}%,topic.ilike.%${escaped}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setList((data ?? []) as unknown as Q[]);
    setTotal(count ?? 0);
    setLoading(false);
    setSelected(new Set());
  }, [page, debouncedSearch, fSubject, fDifficulty, fExam, fClass, fActive]);

  useEffect(() => { load(); }, [load]);

  const allFilteredSelected = list.length > 0 && list.every((q) => selected.has(q.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      list.forEach((q) => next.delete(q.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      list.forEach((q) => next.add(q.id));
      setSelected(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.question_text.trim()) return toast.error("Question required");
    if (editing.options.some((o) => !o.trim())) return toast.error("All 4 options required");
    setSaving(true);
    const payload: any = {
      subject: editing.subject,
      topic: editing.topic,
      difficulty: editing.difficulty,
      question_text: editing.question_text,
      options: editing.options,
      correct_index: editing.correct_index,
      explanation: editing.explanation || null,
      is_active: editing.is_active,
    };
    // Only include if columns exist (graceful no-op if not)
    if (editing.target_exam !== undefined) payload.target_exam = editing.target_exam || null;
    if (editing.class_level !== undefined) payload.class_level = editing.class_level || null;

    const { error } = editing.id
      ? await supabase.from("compete_questions").update(payload).eq("id", editing.id)
      : await supabase.from("compete_questions").insert(payload);
    setSaving(false);
    if (error) {
      // Retry without optional columns if schema lacks them
      if (/column.*(target_exam|class_level)/i.test(error.message)) {
        delete payload.target_exam;
        delete payload.class_level;
        const { error: e2 } = editing.id
          ? await supabase.from("compete_questions").update(payload).eq("id", editing.id)
          : await supabase.from("compete_questions").insert(payload);
        if (e2) return toast.error(e2.message);
      } else {
        return toast.error(error.message);
      }
    }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("compete_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const bulkSetActive = async (active: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("compete_questions").update({ is_active: active }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} updated`);
    load();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} questions? This cannot be undone.`)) return;
    const { error } = await supabase.from("compete_questions").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} deleted`);
    load();
  };

  const clearFilters = () => {
    setSearch(""); setFSubject(""); setFDifficulty(""); setFExam(""); setFClass(""); setFActive("");
  };
  const anyFilter = !!(search || fSubject || fDifficulty || fExam || fClass || fActive);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Swords className="h-5 w-5 text-primary" /> Compete Questions</h1>
          <p className="text-sm text-muted-foreground">{total} questions {selected.size > 0 && `· ${selected.size} selected`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkOpen(true)} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-muted inline-flex items-center gap-1">
            <Upload className="h-4 w-4" /> Bulk upload
          </button>
          <button onClick={() => setEditing({ ...empty })} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> New Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question or topic..." className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-primary" />
          </div>
          <FilterSelect value={fSubject} onChange={setFSubject} label="Subject" options={SUBJECTS} />
          <FilterSelect value={fDifficulty} onChange={setFDifficulty} label="Difficulty" options={DIFFICULTIES} />
          <FilterSelect value={fExam} onChange={setFExam} label="Exam" options={EXAMS} />
          <FilterSelect value={fClass} onChange={setFClass} label="Class" options={CLASS_LEVELS} />
          <FilterSelect value={fActive} onChange={setFActive} label="Status" options={["active", "inactive"]} />
          {anyFilter && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-xs font-bold text-foreground">{selected.size} selected:</span>
            <button onClick={() => bulkSetActive(true)} className="inline-flex items-center gap-1 rounded-md bg-secondary/15 hover:bg-secondary/25 text-secondary px-2 py-1 text-xs font-bold">
              <Eye className="h-3 w-3" /> Activate
            </button>
            <button onClick={() => bulkSetActive(false)} className="inline-flex items-center gap-1 rounded-md bg-muted hover:bg-muted/80 text-foreground px-2 py-1 text-xs font-bold">
              <EyeOff className="h-3 w-3" /> Deactivate
            </button>
            <button onClick={bulkDelete} className="inline-flex items-center gap-1 rounded-md bg-destructive/15 hover:bg-destructive/25 text-destructive px-2 py-1 text-xs font-bold">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                    {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Diff</th>
                <th className="px-3 py-2 font-semibold">Exam</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Question</th>
                <th className="px-3 py-2 font-semibold w-16">Active</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id} className={`border-t border-border ${selected.has(q.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleOne(q.id)} className="text-muted-foreground hover:text-foreground">
                      {selected.has(q.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2">{q.subject}</td>
                  <td className="px-3 py-2">{q.topic}</td>
                  <td className="px-3 py-2 capitalize">{q.difficulty}</td>
                  <td className="px-3 py-2 text-muted-foreground">{q.target_exam || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{q.class_level || "—"}</td>
                  <td className="px-3 py-2 max-w-md truncate"><MathRenderer inline content={q.question_text} /></td>
                  <td className="px-3 py-2">{q.is_active ? <span className="text-secondary font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing({ ...q })} className="p-1 hover:bg-muted rounded"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => remove(q.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">{anyFilter ? "No matches for current filters" : "No questions yet"}</td></tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editing.id ? "Edit Question" : "New Question"}</h2>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Subject">
                <select value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="input">
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Topic"><input value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} className="input" /></Field>
              <Field label="Difficulty">
                <select value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })} className="input">
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Target Exam">
                <select value={editing.target_exam ?? ""} onChange={(e) => setEditing({ ...editing, target_exam: e.target.value })} className="input">
                  <option value="">—</option>
                  {EXAMS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Class Level">
                <select value={editing.class_level ?? ""} onChange={(e) => setEditing({ ...editing, class_level: e.target.value })} className="input">
                  <option value="">—</option>
                  {CLASS_LEVELS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div />
            </div>
            <Field label="Question">
              <textarea value={editing.question_text} onChange={(e) => setEditing({ ...editing, question_text: e.target.value })} rows={3} className="input" />
            </Field>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Options (select correct)</p>
            {editing.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" checked={editing.correct_index === i} onChange={() => setEditing({ ...editing, correct_index: i })} />
                <input value={opt} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => {
                  const opts = [...editing.options]; opts[i] = e.target.value; setEditing({ ...editing, options: opts });
                }} className="input flex-1" />
              </div>
            ))}
            <Field label="Explanation (optional)">
              <textarea value={editing.explanation ?? ""} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} rows={2} className="input" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active (visible to students)
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

      <BulkQuestionUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onUploaded={load}
        mode="compete"
      />

      <style>{`.input { width: 100%; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .input:focus { border-color: hsl(var(--primary)); }`}</style>
    </div>
  );
};

const FilterSelect = ({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) => (
  <div className="inline-flex items-center gap-1">
    <Filter className="h-3 w-3 text-muted-foreground" />
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs rounded-md border border-border bg-background px-2 py-1 outline-none focus:border-primary">
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
    </select>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

export default AdminCompeteQuestionsPage;
