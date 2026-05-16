import { useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Eye,
  EyeOff,
  SkipForward,
  Save,
  ArrowLeft,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";

// ─── Types ───────────────────────────────────────────────────────────────────

type QuestionType = "scq" | "mcq" | "integer" | "match_column" | "assertion_reasoning";

interface MatchEntry { key: string; value: string }

interface ParsedQuestion {
  question_number: number;
  type: QuestionType;
  stem_html: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_options: number[];
  correct_integer: number | null;
  match_col1: MatchEntry[] | null;
  match_col2: MatchEntry[] | null;
  assertion_text: string | null;
  reason_text: string | null;
  images: string[];
  has_latex: boolean;
  omml_detected: boolean;
  needs_review: boolean;
}

type ApprovalStatus = "pending" | "approved" | "skipped";

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_META: Record<QuestionType, { label: string; color: string }> = {
  scq:                 { label: "SCQ",             color: "bg-blue-100 text-blue-700" },
  mcq:                 { label: "MCQ",             color: "bg-purple-100 text-purple-700" },
  integer:             { label: "Integer",         color: "bg-orange-100 text-orange-700" },
  match_column:        { label: "Match Column",    color: "bg-teal-100 text-teal-700" },
  assertion_reasoning: { label: "Assert–Reason",   color: "bg-pink-100 text-pink-700" },
};

// ─── Single question card ─────────────────────────────────────────────────────

interface CardProps {
  q: ParsedQuestion;
  index: number;
  total: number;
  approval: ApprovalStatus;
  onApprove: (updated: ParsedQuestion) => Promise<void>;
  onSkip: () => void;
}

const AR_OPTIONS = [
  { value: "1", label: "(1) Both A and R are true and R is the correct explanation of A" },
  { value: "2", label: "(2) Both A and R are true but R is NOT the correct explanation of A" },
  { value: "3", label: "(3) A is true but R is false" },
  { value: "4", label: "(4) A is false but R is true" },
];

const QuestionCard = ({ q: initial, index, total, approval, onApprove, onSkip }: CardProps) => {
  const [q, setQ] = useState<ParsedQuestion>(initial);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);

  const meta = TYPE_META[q.type];
  const isDone = approval !== "pending";

  const patch = (partial: Partial<ParsedQuestion>) =>
    setQ((prev) => ({ ...prev, ...partial }));

  const toggleCorrect = (opt: number) => {
    if (q.type === "scq") {
      patch({ correct_options: [opt] });
    } else {
      const next = q.correct_options.includes(opt)
        ? q.correct_options.filter((o) => o !== opt)
        : [...q.correct_options, opt];
      patch({ correct_options: next });
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onApprove(q);
    } finally {
      setSaving(false);
    }
  };

  const options: [number, string][] = [
    [1, q.option_1],
    [2, q.option_2],
    [3, q.option_3],
    [4, q.option_4],
  ];

  return (
    <div
      className={`rounded-2xl border bg-card transition-all ${
        approval === "approved"
          ? "border-secondary/40 bg-secondary/5"
          : approval === "skipped"
          ? "border-border opacity-50"
          : "border-border"
      }`}
    >
      {/* Card header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">
          Q{q.question_number}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.color}`}
        >
          {meta.label}
        </span>
        {q.has_latex && (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            LaTeX
          </span>
        )}
        {q.images.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <ImageIcon className="h-2.5 w-2.5" />
            {q.images.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {index + 1} / {total}
          {approval === "approved" && (
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          )}
          {approval === "skipped" && (
            <SkipForward className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* OMML warning */}
      {q.omml_detected && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <strong>Word equation detected</strong> — this question has an OMML formula that couldn't be
            converted automatically. Please enter the LaTeX equivalent manually in the stem below.
          </span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Type selector */}
        <div className="flex flex-wrap gap-1">
          {(["scq", "mcq", "integer", "match_column", "assertion_reasoning"] as QuestionType[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => patch({ type: t })}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  q.type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {TYPE_META[t].label}
              </button>
            ),
          )}
        </div>

        {/* Stem editor */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Question stem (HTML)
          </label>
          <textarea
            value={q.stem_html}
            onChange={(e) => patch({ stem_html: e.target.value })}
            rows={4}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* KaTeX preview toggle */}
        <div>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Hide preview" : "Show preview"}
          </button>

          {showPreview && (
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
              <LatexRenderer html={q.stem_html} />
            </div>
          )}
        </div>

        {/* Embedded images */}
        {q.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {q.images.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block">
                <img
                  src={src}
                  alt={`Image ${i + 1}`}
                  className="h-24 w-auto rounded-lg border border-border object-contain"
                />
              </a>
            ))}
          </div>
        )}

        {/* ── SCQ / MCQ options ────────────────────────────────────────────── */}
        {(q.type === "scq" || q.type === "mcq") && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Options{" "}
              <span className="font-normal text-muted-foreground">
                ({q.type === "scq" ? "select one correct" : "select all correct"})
              </span>
            </p>
            {options.map(([num, text]) => {
              const isCorrect = q.correct_options.includes(num);
              return (
                <div key={num} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleCorrect(num)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold transition-colors ${
                      isCorrect
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-secondary/60"
                    }`}
                  >
                    {q.type === "scq" ? (isCorrect ? "●" : num) : isCorrect ? "✓" : num}
                  </button>
                  <textarea
                    value={text}
                    onChange={(e) =>
                      patch({ [`option_${num}` as "option_1"]: e.target.value })
                    }
                    rows={1}
                    placeholder={`Option (${num})`}
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Integer type ─────────────────────────────────────────────────── */}
        {q.type === "integer" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Correct answer (numeric)
            </label>
            <input
              type="number"
              value={q.correct_integer ?? ""}
              onChange={(e) =>
                patch({ correct_integer: e.target.value === "" ? null : parseFloat(e.target.value) })
              }
              className="w-40 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        )}

        {/* ── Match the column ─────────────────────────────────────────────── */}
        {q.type === "match_column" && (
          <div className="grid grid-cols-2 gap-4">
            {(["match_col1", "match_col2"] as const).map((col, ci) => {
              const entries: MatchEntry[] = q[col] ?? [];
              const placeholder = ci === 0 ? ["a", "b", "c", "d"] : ["P", "Q", "R", "S"];
              return (
                <div key={col}>
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Column {ci === 0 ? "I" : "II"}
                  </p>
                  <div className="space-y-1.5">
                    {(entries.length ? entries : placeholder.map((k) => ({ key: k, value: "" }))).map(
                      (entry, ei) => (
                        <div key={ei} className="flex items-center gap-2">
                          <input
                            value={entry.key}
                            onChange={(e) => {
                              const next = entries.map((en, i) =>
                                i === ei ? { ...en, key: e.target.value } : en,
                              );
                              patch({ [col]: next });
                            }}
                            className="w-10 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <input
                            value={entry.value}
                            onChange={(e) => {
                              const base = entries.length
                                ? entries
                                : placeholder.map((k) => ({ key: k, value: "" }));
                              const next = base.map((en, i) =>
                                i === ei ? { ...en, value: e.target.value } : en,
                              );
                              patch({ [col]: next });
                            }}
                            placeholder={`Value for ${entry.key}`}
                            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Assertion-Reasoning ──────────────────────────────────────────── */}
        {q.type === "assertion_reasoning" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Assertion (A)
              </label>
              <textarea
                value={q.assertion_text ?? ""}
                onChange={(e) => patch({ assertion_text: e.target.value })}
                rows={2}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Reason (R)
              </label>
              <textarea
                value={q.reason_text ?? ""}
                onChange={(e) => patch({ reason_text: e.target.value })}
                rows={2}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Correct option
              </label>
              <div className="space-y-1">
                {AR_OPTIONS.map((opt) => {
                  const num = parseInt(opt.value, 10);
                  const checked = q.correct_options[0] === num;
                  return (
                    <label key={opt.value} className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name={`ar-${q.question_number}`}
                        checked={checked}
                        onChange={() => patch({ correct_options: [num] })}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-foreground">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Card actions */}
        {!isDone && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Save
                </>
              )}
            </button>
          </div>
        )}
        {approval === "approved" && (
          <p className="flex items-center gap-1 text-xs font-semibold text-secondary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved to database
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Review page ──────────────────────────────────────────────────────────────

const AdminReviewQuestionsPage = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const location = useLocation();

  const { questions: initialQuestions = [], paperCode = "" } =
    (location.state as { questions: ParsedQuestion[]; paperId: string; paperCode: string }) ?? {};

  const [questions, setQuestions] = useState<ParsedQuestion[]>(initialQuestions);
  const [approvals, setApprovals] = useState<Record<number, ApprovalStatus>>(() =>
    Object.fromEntries(initialQuestions.map((q) => [q.question_number, "pending"])),
  );
  const [savingAll, setSavingAll] = useState(false);

  const total = questions.length;
  const approvedCount = Object.values(approvals).filter((s) => s === "approved").length;
  const skippedCount = Object.values(approvals).filter((s) => s === "skipped").length;
  const pendingCount = total - approvedCount - skippedCount;
  const progress = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  const saveQuestion = async (q: ParsedQuestion): Promise<void> => {
    const payload: Record<string, unknown> = {
      paper_id: paperId,
      question_number: q.question_number,
      type: q.type,
      stem_html: q.stem_html,
      images: q.images,
      has_latex: q.has_latex,
      needs_review: false,
    };

    if (q.type === "scq" || q.type === "mcq") {
      payload.option_1 = q.option_1;
      payload.option_2 = q.option_2;
      payload.option_3 = q.option_3;
      payload.option_4 = q.option_4;
      payload.correct_options = q.correct_options;
    }
    if (q.type === "integer") {
      payload.correct_integer = q.correct_integer;
    }
    if (q.type === "match_column") {
      payload.match_col1 = q.match_col1;
      payload.match_col2 = q.match_col2;
    }
    if (q.type === "assertion_reasoning") {
      payload.assertion_text = q.assertion_text;
      payload.reason_text = q.reason_text;
      payload.correct_options = q.correct_options;
    }

    const { error } = await (supabase as any).from("questions").insert(payload);
    if (error) throw new Error(error.message);
  };

  const handleApprove = async (index: number, updated: ParsedQuestion) => {
    await saveQuestion(updated);
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
    setApprovals((prev) => ({ ...prev, [updated.question_number]: "approved" }));
    toast.success(`Q${updated.question_number} saved`);
  };

  const handleSkip = (num: number) => {
    setApprovals((prev) => ({ ...prev, [num]: "skipped" }));
  };

  const handleSaveAll = async () => {
    const pending = questions.filter(
      (q) => approvals[q.question_number] === "pending",
    );
    if (!pending.length) { toast.info("Nothing left to save"); return; }

    setSavingAll(true);
    let saved = 0;
    let failed = 0;
    for (const q of pending) {
      try {
        await saveQuestion(q);
        setApprovals((prev) => ({ ...prev, [q.question_number]: "approved" }));
        saved++;
      } catch {
        failed++;
      }
    }
    setSavingAll(false);
    if (saved) toast.success(`Saved ${saved} question${saved === 1 ? "" : "s"}`);
    if (failed) toast.error(`${failed} question${failed === 1 ? "" : "s"} failed to save`);
  };

  if (!paperId) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Invalid paper ID.</div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No parsed questions found for this paper.
        </p>
        <Link
          to="/admin/upload-questions"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/upload-questions"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-black font-display text-foreground">
              Review — {paperCode || paperId}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedCount} approved · {skippedCount} skipped · {pendingCount} pending
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={savingAll || pendingCount === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {savingAll ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save All Pending ({pendingCount})
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{approvedCount} of {total} approved</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(["scq", "mcq", "integer", "match_column", "assertion_reasoning"] as QuestionType[]).map(
          (t) => {
            const count = questions.filter((q) => q.type === t).length;
            if (!count) return null;
            const meta = TYPE_META[t];
            return (
              <span key={t} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
                {count} {meta.label}
              </span>
            );
          },
        )}
        {questions.some((q) => q.omml_detected) && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {questions.filter((q) => q.omml_detected).length} Word equations need LaTeX
          </span>
        )}
      </div>

      {/* Question cards */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.question_number}
            q={q}
            index={i}
            total={total}
            approval={approvals[q.question_number] ?? "pending"}
            onApprove={(updated) => handleApprove(i, updated)}
            onSkip={() => handleSkip(q.question_number)}
          />
        ))}
      </div>

      {/* Bottom save all */}
      {pendingCount > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={savingAll}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-40"
          >
            {savingAll ? (
              "Saving…"
            ) : (
              <>
                <Save className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-1" />
                Save All Pending ({pendingCount})
              </>
            )}
          </button>
        </div>
      )}

      {/* All done banner */}
      {pendingCount === 0 && total > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-foreground">All questions processed</p>
            <p className="text-xs text-muted-foreground">
              {approvedCount} approved, {skippedCount} skipped.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewQuestionsPage;
