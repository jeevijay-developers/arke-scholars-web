import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, GripVertical, BookMarked, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { useQuestionBank, type BankQuestion } from "@/hooks/useQuestionBank";
import QuestionEditorDialog from "./QuestionEditorDialog";
import LatexRenderer from "./LatexRenderer";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { SUBJECTS_WITH_ALL as SUBJECTS } from "@/lib/constants";
const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"];
const PAGE_SIZE = 25;

const difficultyColor = (d: string) => {
  if (d === "easy") return "bg-emerald-100 text-emerald-700";
  if (d === "hard") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

type SortKey = "question_text" | "subject" | "topic" | "difficulty";
type SortDir = "asc" | "desc";

type CardProps = {
  q: BankQuestion;
  draggable?: boolean;
  onEdit?: (q: BankQuestion) => void;
  onDelete?: (q: BankQuestion) => void;
  compact?: boolean;
};

const QuestionCard = ({ q, draggable, onEdit, onDelete, compact }: CardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bank-${q.id}`,
    data: { question: q },
    disabled: !draggable,
  });

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className={`rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-all ${isDragging ? "opacity-40" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div className="flex items-start gap-2">
        {draggable && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{q.subject}</span>
            {q.topic && <span className="text-[10px] font-medium text-muted-foreground">{q.topic}</span>}
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize ${difficultyColor(q.difficulty)}`}>{q.difficulty}</span>
          </div>
          <div className={`text-foreground ${compact ? "text-xs line-clamp-2" : "text-sm line-clamp-3"}`}>
            <LatexRenderer html={q.question_text} />
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex flex-col gap-1 shrink-0">
            {onEdit && (
              <button onClick={() => onEdit(q)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(q)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

type Props = {
  draggable?: boolean;
  manage?: boolean;
  compact?: boolean;
  tableView?: boolean;
  className?: string;
};

const SortHeader = ({ label, active, dir, onClick, className = "" }: { label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string }) => (
  <th className={`px-3 py-2 text-left font-semibold ${className}`}>
    <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
      {label}
      {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  </th>
);

const QuestionBankPanel = ({ draggable = false, manage = false, compact = false, tableView = false, className = "" }: Props) => {
  const [subject, setSubject] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [topic, setTopic] = useState("All");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("question_text");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkDifficulty, setBulkDifficulty] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Server-side filters (subject/difficulty/search) — topic filtered client-side
  const filters = useMemo(() => ({ subject, difficulty, search }), [subject, difficulty, search]);
  const { questions, loading, reload } = useQuestionBank(filters);

  // Reset page when filters/sort change
  useEffect(() => { setPage(1); }, [subject, difficulty, topic, search, sortKey, sortDir]);

  // Topic options derived from current dataset
  const topicOptions = useMemo(() => {
    const s = new Set<string>();
    questions.forEach((q) => { if (q.topic) s.add(q.topic); });
    return ["All", ...Array.from(s).sort()];
  }, [questions]);

  // Filter (topic) + sort
  const processed = useMemo(() => {
    let list = questions;
    if (topic !== "All") list = list.filter((q) => (q.topic || "") === topic);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase();
      const bv = (b[sortKey] || "").toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [questions, topic, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const pageItems = useMemo(() => processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [processed, page]);
  const pageIds = useMemo(() => pageItems.map((q) => q.id), [pageItems]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (q: BankQuestion) => {
    const ok = await confirm({
      title: "Delete this question?",
      description: "It will be removed from the question bank. Tests already using it will keep their copy, but it can't be added to new tests.",
      confirmLabel: "Delete question",
    });
    if (!ok) return;
    const { error } = await supabase.from("question_bank").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = await confirm({
      title: `Delete ${ids.length} question${ids.length > 1 ? "s" : ""}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const { error } = await supabase.from("question_bank").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length} question${ids.length > 1 ? "s" : ""}`);
    clearSelection();
    reload();
  };

  const openBulkEdit = () => {
    setBulkSubject(""); setBulkTopic(""); setBulkDifficulty("");
    setBulkEditOpen(true);
  };

  const handleBulkEditSave = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const patch: { subject?: string; topic?: string; difficulty?: string } = {};
    if (bulkSubject) patch.subject = bulkSubject;
    if (bulkTopic.trim()) patch.topic = bulkTopic.trim();
    if (bulkDifficulty) patch.difficulty = bulkDifficulty.toLowerCase();
    if (!Object.keys(patch).length) {
      toast.error("Set at least one field to update");
      return;
    }
    setBulkSaving(true);
    const { error } = await supabase.from("question_bank").update(patch).in("id", ids);
    setBulkSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${ids.length} question${ids.length > 1 ? "s" : ""}`);
    setBulkEditOpen(false);
    clearSelection();
    reload();
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* Filters */}
      <div className="space-y-2 p-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground flex-1">Question Bank</h3>
          {manage && (
            <button onClick={() => { setEditing(null); setEditorOpen(true); }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
              <Plus className="h-3 w-3" /> New
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..." className="flex-1 bg-transparent text-xs outline-none" />
          </div>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none" aria-label="Filter by subject">
            {SUBJECTS.map((s) => <option key={s} value={s}>{s === "All" ? "All subjects" : s}</option>)}
          </select>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none max-w-[160px]" aria-label="Filter by topic">
            {topicOptions.map((t) => <option key={t} value={t}>{t === "All" ? "All topics" : t}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none" aria-label="Filter by difficulty">
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d === "All" ? "All difficulty" : d}</option>)}
          </select>
        </div>
        {tableView && manage && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5">
            <span className="text-xs font-semibold text-foreground">{selected.size} selected</span>
            <div className="flex-1" />
            <button onClick={openBulkEdit} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-muted">
              <Edit2 className="h-3 w-3" /> Bulk edit
            </button>
            <button onClick={handleBulkDelete} className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button onClick={clearSelection} className="rounded-md p-1 text-muted-foreground hover:bg-muted" title="Clear selection">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground py-6">Loading…</p>
        ) : processed.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">No questions found.</p>
        ) : tableView ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>
                    {manage && (
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                          onChange={togglePage}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          aria-label="Select all on page"
                        />
                      </th>
                    )}
                    <SortHeader label="Question" active={sortKey === "question_text"} dir={sortDir} onClick={() => toggleSort("question_text")} />
                    <SortHeader label="Subject" active={sortKey === "subject"} dir={sortDir} onClick={() => toggleSort("subject")} className="w-32" />
                    <SortHeader label="Topic" active={sortKey === "topic"} dir={sortDir} onClick={() => toggleSort("topic")} className="w-40" />
                    <SortHeader label="Difficulty" active={sortKey === "difficulty"} dir={sortDir} onClick={() => toggleSort("difficulty")} className="w-28" />
                    {manage && <th className="px-3 py-2 text-right font-semibold w-28">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((q) => {
                    const isSel = selected.has(q.id);
                    return (
                      <tr key={q.id} className={`border-t border-border transition-colors align-top ${isSel ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                        {manage && (
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleRow(q.id)}
                              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                              aria-label="Select question"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 max-w-xl">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              {(q.question_type ?? "scq").replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-foreground line-clamp-2">
                            <LatexRenderer html={q.question_text} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">{q.subject}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{q.topic || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold capitalize ${difficultyColor(q.difficulty)}`}>{q.difficulty}</span>
                        </td>
                        {manage && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditing(q); setEditorOpen(true); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(q)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination page={page} totalPages={totalPages} total={processed.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{processed.length} questions{draggable ? " · drag to add" : ""}</p>
            <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"}>
              {processed.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  draggable={draggable}
                  compact={compact}
                  onEdit={manage ? (q) => { setEditing(q); setEditorOpen(true); } : undefined}
                  onDelete={manage ? handleDelete : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <QuestionEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={reload} initial={editing} />

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk edit {selected.size} question{selected.size > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Leave a field blank to keep its existing value.</p>
            <div>
              <label className="text-xs font-semibold text-foreground">Subject</label>
              <select value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none">
                <option value="">— No change —</option>
                {SUBJECTS.filter((s) => s !== "All").map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Topic</label>
              <input value={bulkTopic} onChange={(e) => setBulkTopic(e.target.value)} placeholder="No change" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Difficulty</label>
              <select value={bulkDifficulty} onChange={(e) => setBulkDifficulty(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none">
                <option value="">— No change —</option>
                {DIFFICULTIES.filter((d) => d !== "All").map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setBulkEditOpen(false)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted">Cancel</button>
            <button onClick={handleBulkEditSave} disabled={bulkSaving} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {bulkSaving ? "Saving…" : "Apply changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
};

export default QuestionBankPanel;
