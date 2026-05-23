import { useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
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
import { useAuth } from "@/context/AuthContext";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const AR_OPTIONS_TEXT = [
  "Both A and R are true and R is the correct explanation of A",
  "Both A and R are true but R is NOT the correct explanation of A",
  "A is true but R is false",
  "A is false but R is true",
];

// ─── Types ────────────────────────────────────────────────────────────────────

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
  match_answer: string | null;
  assertion_text: string | null;
  reason_text: string | null;
  images: string[];
  solution_html: string;
  has_latex: boolean;
  needs_review: boolean;
}

type ApprovalStatus = "pending" | "approved" | "skipped";

const TYPE_META: Record<QuestionType, { label: string; color: string }> = {
  scq:                 { label: "SCQ",           color: "bg-blue-100 text-blue-700" },
  mcq:                 { label: "MCQ",           color: "bg-purple-100 text-purple-700" },
  integer:             { label: "Integer",       color: "bg-orange-100 text-orange-700" },
  match_column:        { label: "Match Column",  color: "bg-teal-100 text-teal-700" },
  assertion_reasoning: { label: "Assert–Reason", color: "bg-pink-100 text-pink-700" },
};

const IMG_H = "160px";

const ImageGallery = ({ urls }: { urls: string[] }) => {
  if (!urls.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-block">
          <img
            src={url}
            alt={`Image ${i + 1}`}
            style={{ maxHeight: IMG_H }}
            className="w-auto rounded-xl border border-border object-contain bg-muted/20"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
              const p = document.createElement("span");
              p.textContent = "⚠ Image failed to load";
              p.className = "text-xs text-muted-foreground";
              el.parentElement?.appendChild(p);
            }}
          />
        </a>
      ))}
    </div>
  );
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

  const stemHasImages = /<img/i.test(q.stem_html ?? "");
  const imgCount = (q.images?.length ?? 0) + (stemHasImages ? 1 : 0);

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
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">Q{q.question_number}</span>
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
        {imgCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <ImageIcon className="h-2.5 w-2.5" />
            {imgCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {index + 1} / {total}
          {approval === "approved" && <CheckCircle2 className="h-4 w-4 text-secondary" />}
          {approval === "skipped" && <SkipForward className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

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

        {/* Rendered preview */}
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
              <LatexRenderer html={q.stem_html} className="[&_img]:hidden" />
            </div>
          )}
        </div>

        {/* Image gallery */}
        {imgCount > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-foreground">Images</p>
            <ImageGallery urls={q.images} />
          </div>
        )}

        {/* ── SCQ / MCQ options ─────────────────────────────────────────────── */}
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
                <div key={num} className="space-y-1">
                  <div className="flex items-start gap-2">
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
                      rows={2}
                      placeholder={`Option (${num})`}
                      className="flex-1 resize-y rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  {text && (
                    <div className={`ml-7 rounded-lg border px-3 py-1.5 text-xs ${isCorrect ? "border-secondary/30 bg-secondary/5" : "border-border bg-muted/20"}`}>
                      <LatexRenderer html={text} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Integer ──────────────────────────────────────────────────────── */}
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
          <div className="space-y-3">
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
                                const base = entries.length
                                  ? entries
                                  : placeholder.map((k) => ({ key: k, value: "" }));
                                const next = base.map((en, i) =>
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Match answer (e.g. "A-P, B-Q, C-R, D-S")
              </label>
              <input
                value={q.match_answer ?? ""}
                onChange={(e) => patch({ match_answer: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        )}

        {/* ── Assertion-Reasoning ───────────────────────────────────────────── */}
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

        {/* ── Solution editor ──────────────────────────────────────────────── */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Solution (HTML)
          </label>
          <textarea
            value={q.solution_html ?? ""}
            onChange={(e) => patch({ solution_html: e.target.value })}
            rows={4}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {q.solution_html && (
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
              <LatexRenderer html={q.solution_html} />
            </div>
          )}
        </div>

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
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Review page ──────────────────────────────────────────────────────────────

function buildTestQuestionRow(q: ParsedQuestion, position: number, subject: string, testId: string) {
  let options: unknown = [];
  let correct_answer: unknown = null;

  if (q.type === "scq" || q.type === "mcq") {
    options = [q.option_1, q.option_2, q.option_3, q.option_4]
      .map((text, idx) => ({ id: idx + 1, text }))
      .filter((o) => (o.text ?? "").trim().length > 0);
    correct_answer = q.correct_options ?? [];
  } else if (q.type === "integer") {
    options = [];
    correct_answer = q.correct_integer;
  } else if (q.type === "match_column") {
    options = { col1: q.match_col1 ?? [], col2: q.match_col2 ?? [] };
    correct_answer = q.match_answer ?? "";
  } else if (q.type === "assertion_reasoning") {
    options = AR_OPTIONS_TEXT.map((text, idx) => ({ id: idx + 1, text }));
    correct_answer = q.correct_options ?? [];
  }

  return {
    test_id: testId,
    position,
    subject,
    topic: null,
    question_text: q.stem_html,
    question_image_url: q.images?.[0] ?? null,
    question_type: q.type,
    options,
    correct_answer,
    explanation: q.solution_html ?? null,
    marks_correct: 4,
    marks_wrong: -1,
  };
}

const AdminReviewQuestionsPage = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { questions: initialQuestions = [], paperCode = "", subject = "Physics", durationMinutes = 180, courseId = null } =
    (location.state as { questions: ParsedQuestion[]; paperId: string; paperCode: string; subject?: string; durationMinutes?: number; courseId?: string | null }) ?? {};

  const [questions, setQuestions] = useState<ParsedQuestion[]>(initialQuestions);
  const [approvals, setApprovals] = useState<Record<number, ApprovalStatus>>(() =>
    Object.fromEntries(initialQuestions.map((q) => [q.question_number, "pending"])),
  );
  const [publishing, setPublishing] = useState(false);

  const total = questions.length;
  const approvedCount = Object.values(approvals).filter((s) => s === "approved").length;
  const skippedCount  = Object.values(approvals).filter((s) => s === "skipped").length;
  const pendingCount  = total - approvedCount - skippedCount;
  // Anything not explicitly skipped is included in the test (approved + pending).
  const includedCount = total - skippedCount;
  const progress = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  // Per-question Approve is now a state-only flag (no DB write). The single writer is publishAsTest.
  const handleApprove = async (index: number, updated: ParsedQuestion) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
    setApprovals((prev) => ({ ...prev, [updated.question_number]: "approved" }));
  };

  const handleSkip = (num: number) => {
    setApprovals((prev) => ({ ...prev, [num]: "skipped" }));
  };

  const publishAsTest = async () => {
    if (!user) { toast.error("You must be signed in"); return; }
    const included = questions.filter((q) => approvals[q.question_number] !== "skipped");
    if (!included.length) { toast.error("No questions to publish (all skipped)"); return; }

    setPublishing(true);
    try {
      const title = paperCode || `Imported test ${new Date().toISOString().slice(0, 10)}`;
      const slug = `${slugify(title)}-${Date.now().toString(36)}`;

      const { data: testRow, error: testErr } = await (supabase as any)
        .from("tests")
        .insert({
          title,
          slug,
          test_type: "mock",
          exam_pattern: "jee-main",
          subjects: [subject],
          duration_minutes: durationMinutes,
          correct_marks: 4,
          wrong_marks: -1,
          total_questions: included.length,
          total_marks: included.length * 4,
          visibility: "public",
          is_published: false, // draft — admin reviews / publishes from /admin/tests
          created_by: user.id,
          course_id: courseId ?? null,
        })
        .select("id, slug")
        .single();

      if (testErr || !testRow) throw new Error(testErr?.message ?? "Could not create test");

      const rows = included.map((q, i) => buildTestQuestionRow(q, i, subject, testRow.id));
      const { error: tqErr } = await (supabase as any).from("test_questions").insert(rows);
      if (tqErr) {
        // Best-effort rollback so we don't leave an empty test in /admin/tests
        await (supabase as any).from("tests").delete().eq("id", testRow.id);
        throw new Error(tqErr.message);
      }

      // Also populate the reusable question bank. Non-fatal: pool failure
      // must not roll back the published test.
      const poolRows = included.map((q) => ({
        paper_id: paperId,
        question_number: q.question_number,
        type: q.type,
        stem_html: q.stem_html,
        option_1: q.option_1 || null,
        option_2: q.option_2 || null,
        option_3: q.option_3 || null,
        option_4: q.option_4 || null,
        correct_options: q.correct_options?.length ? q.correct_options : null,
        correct_integer: q.correct_integer ?? null,
        match_col1: q.match_col1 ?? null,
        match_col2: q.match_col2 ?? null,
        match_answer: q.match_answer ?? null,
        assertion_text: q.assertion_text ?? null,
        reason_text: q.reason_text ?? null,
        images: q.images,
        solution_html: q.solution_html || null,
        has_latex: q.has_latex,
        needs_review: false,
      }));
      const { error: poolErr } = await (supabase as any).from("questions").insert(poolRows);
      if (poolErr) {
        console.warn("Question bank insert failed:", poolErr.message);
        toast.warning("Test published, but question bank insert failed — questions not added to bank.");
      }

      toast.success(`Test created with ${included.length} question${included.length === 1 ? "" : "s"}`);
      navigate("/admin/tests");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Publish failed: ${msg}`);
    } finally {
      setPublishing(false);
    }
  };

  if (!paperId) {
    return <div className="p-6 text-muted-foreground text-sm">Invalid paper ID.</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-sm text-muted-foreground">No parsed questions found for this paper.</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/upload-questions" className="text-muted-foreground hover:text-foreground">
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
          onClick={publishAsTest}
          disabled={publishing || includedCount === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {publishing ? "Publishing…" : <><Save className="h-4 w-4" /> Publish as Test ({includedCount})</>}
        </button>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{approvedCount} of {total} approved · {includedCount} will be included</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["scq", "mcq", "integer", "match_column", "assertion_reasoning"] as QuestionType[]).map((t) => {
          const count = questions.filter((q) => q.type === t).length;
          if (!count) return null;
          const meta = TYPE_META[t];
          return (
            <span key={t} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
              {count} {meta.label}
            </span>
          );
        })}
      </div>

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

      {includedCount > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={publishAsTest}
            disabled={publishing}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-40"
          >
            {publishing ? "Publishing…" : (
              <>
                <Save className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-1" />
                Publish as Test ({includedCount})
              </>
            )}
          </button>
        </div>
      )}

      {pendingCount === 0 && total > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-foreground">All questions reviewed</p>
            <p className="text-xs text-muted-foreground">
              {approvedCount} approved, {skippedCount} skipped — click <strong>Publish as Test</strong> to save.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewQuestionsPage;
