/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit3, Loader2, Swords, Search, CheckSquare, Square,
  Filter, EyeOff, Eye, X, Upload,
} from "lucide-react";
import HtmlField from "@/components/HtmlField";
import LatexRenderer from "@/components/LatexRenderer";
import BulkQuestionUploadDialog from "@/components/BulkQuestionUploadDialog";
import { useExams } from "@/hooks/useExams";
import TablePagination from "@/components/TablePagination";
import { SUBJECTS_COMPETE } from "@/lib/constants";

// ─── types ───────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  target_exam?: string | null;
  class_level?: string | null;
  question_text: string;
  question_type: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  is_active: boolean;
};

type EditingQ = Omit<Q, "id"> & {
  id?: string;
  _options: string[];      // 4 HTML strings
  _correctIdx: number;     // 0-indexed correct option
  _solution: string;
};

// ─── constants ───────────────────────────────────────────────────────────────

const SUBJECTS: string[] = [...SUBJECTS_COMPETE];
const DIFFICULTIES = ["easy", "medium", "hard"];
const CLASS_LEVELS = ["6","7","8", "9", "10", "11", "12", "Dropper"];
const PAGE_SIZE = 20;

const BLANK_EDITING: EditingQ = {
  subject: "Physics",
  topic: "Kinematics",
  difficulty: "medium",
  target_exam: "JEE Main",
  class_level: "11",
  question_text: "",
  question_type: "scq",
  options: [],
  correct_index: 0,
  explanation: "",
  is_active: true,
  _options: ["", "", "", ""],
  _correctIdx: 0,
  _solution: "",
};

function editingFromRow(q: Q): EditingQ {
  const opts = Array.isArray(q.options) ? q.options : [];
  return {
    ...q,
    question_type: "scq",
    _options: opts.concat(["", "", "", ""]).slice(0, 4),
    _correctIdx: Math.max(0, q.correct_index ?? 0),
    _solution: q.explanation || "",
  };
}

// ─── editor dialog ────────────────────────────────────────────────────────────

type EditorProps = {
  editing: EditingQ;
  onChange: (next: EditingQ) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  exams: string[];
};

const CompeteEditorDialog = ({ editing, onChange, onClose, onSave, saving, exams }: EditorProps) => {
  const set = (patch: Partial<EditingQ>) => onChange({ ...editing, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h2 className="text-base font-bold">{editing.id ? "Edit Question" : "New Question"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Meta fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Subject</label>
              <select value={editing.subject} onChange={(e) => set({ subject: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Topic</label>
              <input value={editing.topic} onChange={(e) => set({ topic: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" placeholder="e.g. Kinematics" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Difficulty</label>
              <select value={editing.difficulty} onChange={(e) => set({ difficulty: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Target Exam</label>
              <select value={editing.target_exam ?? ""} onChange={(e) => set({ target_exam: e.target.value || null })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="">—</option>
                {exams.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Class Level</label>
              <select value={editing.class_level ?? ""} onChange={(e) => set({ class_level: e.target.value || null })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="">—</option>
                {CLASS_LEVELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
                Active (visible to students)
              </label>
            </div>
          </div>

          {/* Question stem */}
          <div>
            <label className="text-xs font-semibold text-foreground">Question</label>
            <p className="text-[11px] text-muted-foreground mb-1.5">Supports $LaTeX$, $\ce{"{H2O}"}$ chemistry, and inline images via the Image button.</p>
            <HtmlField
              value={editing.question_text}
              onChange={(v) => set({ question_text: v })}
              rows={4}
              placeholder="Question text — can include diagrams, equations, and HTML"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Options <span className="font-normal text-muted-foreground">(click the letter to mark correct)</span></p>
            {editing._options.map((opt, i) => {
              const isCorrect = editing._correctIdx === i;
              return (
                <div key={i} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => set({ _correctIdx: i })}
                    className={`mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      isCorrect
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-secondary/60"
                    }`}
                    title={isCorrect ? "Correct answer" : "Mark as correct"}
                  >
                    {String.fromCharCode(65 + i)}
                  </button>
                  <div className="flex-1">
                    <HtmlField
                      value={opt}
                      rows={2}
                      placeholder={`Option ${String.fromCharCode(65 + i)} — text, $LaTeX$, or image`}
                      onChange={(next) => {
                        const arr = [...editing._options];
                        arr[i] = next;
                        set({ _options: arr });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Solution */}
          <div>
            <label className="text-xs font-semibold text-foreground">Solution / Explanation (optional)</label>
            <div className="mt-1.5">
              <HtmlField
                value={editing._solution}
                onChange={(v) => set({ _solution: v })}
                rows={3}
                placeholder="Step-by-step solution. Supports $LaTeX$ and images."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
          <button disabled={saving} onClick={onSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── main page ────────────────────────────────────────────────────────────────

const AdminCompeteQuestionsPage = () => {
  const { examNames: EXAMS } = useExams();
  const [list, setList] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingQ | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fSubject, setFSubject] = useState<string>("");
  const [fDifficulty, setFDifficulty] = useState<string>("");
  const [fExam, setFExam] = useState<string>("");
  const [fClass, setFClass] = useState<string>("");
  const [fActive, setFActive] = useState<string>("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, fSubject, fDifficulty, fExam, fClass, fActive]);

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
    const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) { toast.error(error.message); setLoading(false); return; }
    setList((data ?? []) as unknown as Q[]);
    setTotal(count ?? 0);
    setLoading(false);
    setSelected(new Set());
  }, [page, debouncedSearch, fSubject, fDifficulty, fExam, fClass, fActive]);

  useEffect(() => { load(); }, [load]);

  const allSelected = list.length > 0 && list.every((q) => selected.has(q.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) list.forEach((q) => next.delete(q.id));
    else list.forEach((q) => next.add(q.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const save = async () => {
    if (!editing || inFlight.current || saving) return;
    if (!editing.question_text.trim()) return toast.error("Question text required");
    const filledOpts = editing._options.filter((o) => o.trim());
    if (filledOpts.length < 2) return toast.error("At least 2 options required");

    const payload: Record<string, unknown> = {
      subject: editing.subject,
      topic: editing.topic,
      difficulty: editing.difficulty,
      question_text: editing.question_text,
      question_type: "scq",
      options: editing._options,
      correct_index: editing._correctIdx,
      explanation: editing._solution.trim() || null,
      is_active: editing.is_active,
      target_exam: editing.target_exam || null,
      class_level: editing.class_level || null,
    };

    inFlight.current = true;
    setSaving(true);
    try {
      const { error } = editing.id
        ? await supabase.from("compete_questions" as any).update(payload).eq("id", editing.id)
        : await supabase.from("compete_questions" as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(editing.id ? "Question updated" : "Question added");
      setEditing(null);
      load();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("compete_questions" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const bulkSetActive = async (active: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from("compete_questions" as any).update({ is_active: active }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} updated`);
    load();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} questions? This cannot be undone.`)) return;
    const { error } = await supabase.from("compete_questions" as any).delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} deleted`);
    load();
  };

  const clearFilters = () => { setSearch(""); setFSubject(""); setFDifficulty(""); setFExam(""); setFClass(""); setFActive(""); };
  const anyFilter = !!(search || fSubject || fDifficulty || fExam || fClass || fActive);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" /> Compete Questions
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} questions{selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="rounded-lg bg-secondary/20 hover:bg-secondary/30 px-4 py-2 text-sm font-bold text-secondary inline-flex items-center gap-1 transition-colors"
          >
            <Upload className="h-4 w-4" /> Bulk Upload
          </button>
          <button
            onClick={() => setEditing({ ...BLANK_EDITING })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> New Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question or topic..."
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background outline-none focus:border-primary"
            />
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
            <span className="text-xs font-bold">{selected.size} selected:</span>
            <button onClick={() => bulkSetActive(true)} className="inline-flex items-center gap-1 rounded-md bg-secondary/15 hover:bg-secondary/25 text-secondary px-2 py-1 text-xs font-bold">
              <Eye className="h-3 w-3" /> Activate
            </button>
            <button onClick={() => bulkSetActive(false)} className="inline-flex items-center gap-1 rounded-md bg-muted hover:bg-muted/80 text-foreground px-2 py-1 text-xs font-bold">
              <EyeOff className="h-3 w-3" /> Deactivate
            </button>
            <button onClick={bulkDelete} className="inline-flex items-center gap-1 rounded-md bg-destructive/15 hover:bg-destructive/25 text-destructive px-2 py-1 text-xs font-bold">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 w-8">
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                    {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Diff</th>
                <th className="px-3 py-2 font-semibold">Exam</th>
                <th className="px-3 py-2 font-semibold">Question</th>
                <th className="px-3 py-2 font-semibold w-16">Active</th>
                <th className="px-3 py-2 w-20" />
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
                  <td className="px-3 py-2 max-w-xs">
                    <div className="truncate"><LatexRenderer html={q.question_text} /></div>
                  </td>
                  <td className="px-3 py-2">
                    {q.is_active
                      ? <span className="text-secondary font-bold">Yes</span>
                      : <span className="text-muted-foreground">No</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing(editingFromRow(q))} className="p-1 hover:bg-muted rounded">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(q.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    {anyFilter ? "No matches for current filters" : "No questions yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {editing && (
        <CompeteEditorDialog
          editing={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
          exams={EXAMS}
        />
      )}

      <BulkQuestionUploadDialog
        open={showBulkUpload}
        mode="compete"
        onClose={() => setShowBulkUpload(false)}
        onUploaded={() => {
          setShowBulkUpload(false);
          load();
        }}
      />
    </div>
  );
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const FilterSelect = ({
  value, onChange, label, options,
}: { value: string; onChange: (v: string) => void; label: string; options: string[] }) => (
  <div className="inline-flex items-center gap-1">
    <Filter className="h-3 w-3 text-muted-foreground" />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs rounded-md border border-border bg-background px-2 py-1 outline-none focus:border-primary"
    >
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
    </select>
  </div>
);

export default AdminCompeteQuestionsPage;
