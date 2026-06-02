import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Upload, Loader2, BookOpen, Tag, Clock,
  AlertTriangle, CheckCircle2, ImageIcon, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUBJECTS } from "@/lib/constants";
import LatexRenderer from "@/components/LatexRenderer";

// ─── Types (mirrors edge function output) ─────────────────────────────────────

type QuestionType = "scq" | "mcq" | "integer" | "match_column" | "assertion_reasoning";

interface MatchEntry { key: string; value: string }

export interface ParsedQuestion {
  question_number: number;
  type: QuestionType;
  topic: string | null;
  stem_html: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_1_image: string | null;
  option_2_image: string | null;
  option_3_image: string | null;
  option_4_image: string | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<QuestionType, string> = {
  scq: "SCQ",
  mcq: "MCQ",
  integer: "Integer",
  match_column: "Match",
  assertion_reasoning: "A/R",
};

const TYPE_COLOUR: Record<QuestionType, string> = {
  scq: "bg-blue-100 text-blue-700",
  mcq: "bg-purple-100 text-purple-700",
  integer: "bg-green-100 text-green-700",
  match_column: "bg-orange-100 text-orange-700",
  assertion_reasoning: "bg-pink-100 text-pink-700",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatAnswer(q: ParsedQuestion): string {
  if (q.type === "integer") return q.correct_integer !== null ? String(q.correct_integer) : "—";
  if (q.type === "scq" || q.type === "mcq" || q.type === "assertion_reasoning") {
    return q.correct_options.length ? q.correct_options.map((n) => `(${n})`).join(", ") : "—";
  }
  if (q.type === "match_column") {
    return q.match_answer ?? "—";
  }
  return "—";
}

// ─── Component ────────────────────────────────────────────────────────────────

type Status = "idle" | "creating" | "parsing" | "preview";

const AdminUploadQuestionsPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [paperName, setPaperName] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [durationMinutes, setDurationMinutes] = useState<number>(180);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.from("courses").select("id, name").order("name").then(({ data }) => {
      setCourses(data ?? []);
    });
  }, []);

  const [status, setStatus] = useState<Status>("idle");
  const [paperId, setPaperId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<{
    questions: ParsedQuestion[];
    skipped: number;
    warnings: string[];
  } | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  function toggleCard(num: number) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  }

  const busy = status !== "idle" && status !== "preview";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setFile(null); return; }
    if (!f.name.toLowerCase().endsWith(".docx")) {
      toast.error("Please upload a .docx file. Other formats are not supported.");
      e.target.value = "";
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 20 MB.");
      e.target.value = "";
      return;
    }
    setFile(f);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperName.trim()) { toast.error("Test paper name is required"); return; }
    if (!file) { toast.error("Please select a .docx file"); return; }

    let createdPaperId: string | null = null;
    try {
      setStatus("creating");
      const { data: paper, error: paperErr } = await (supabase as any)
        .from("papers")
        .insert({ code: paperName.trim(), subject })
        .select("id")
        .single();
      if (paperErr) {
        toast.error("Could not create paper record. Please try again.");
        setStatus("idle");
        return;
      }
      createdPaperId = paper.id as string;
      setPaperId(createdPaperId);

      setStatus("parsing");
      const form = new FormData();
      form.append("file", file);
      form.append("paper_id", createdPaperId);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-docx`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        toast.error(`Upload failed: ${err.error ?? "Parse failed"}.`);
        setStatus("idle");
        return;
      }

      const result = await res.json() as { questions: ParsedQuestion[]; skipped: number; warnings: string[] };

      if (!result.questions || result.questions.length === 0) {
        toast.error("No questions could be parsed. Please check your file matches the expected template.");
        setStatus("idle");
        return;
      }

      setParseResult({
        questions: result.questions ?? [],
        skipped: result.skipped ?? 0,
        warnings: result.warnings ?? [],
      });
      setWarningsOpen(false);
      setStatus("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setStatus("idle");
    }
  };

  const handleConfirm = () => {
    if (!parseResult || !paperId) return;
    // No DB write here — the review page is the single writer (creates the `tests` row
    // and `test_questions` rows on Save All). This avoids the prior duplicate-insert bug.
    navigate(`/admin/review-questions/${paperId}`, {
      state: { questions: parseResult.questions, paperId, paperCode: paperName, subject, durationMinutes, courseId },
    });
  };

  const handleCancel = async () => {
    if (paperId) {
      await (supabase as any).from("papers").delete().eq("id", paperId);
    }
    setParseResult(null);
    setPaperId(null);
    setStatus("idle");
    setFile(null);
    setPaperName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render: preview panel ─────────────────────────────────────────────────
  if (status === "preview" && parseResult) {
    const { questions, skipped = 0, warnings = [] } = parseResult;
    return (
      <div className="p-4 lg:p-6 max-w-3xl">
        <div className="mb-5">
          <h1 className="text-xl font-black font-display text-foreground">Review Parsed Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the questions look correct before committing them to the database.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">
            {questions.length} question{questions.length !== 1 ? "s" : ""} parsed
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{skipped} skipped</span>
          {warnings.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <button
                className="flex items-center gap-1 text-amber-600 hover:underline font-medium"
                onClick={() => setWarningsOpen((o) => !o)}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                {warningsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </>
          )}
        </div>

        {warningsOpen && warnings.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-amber-800">{w}</p>
            ))}
          </div>
        )}

        <div className="mb-6 space-y-2 max-h-[68vh] overflow-y-auto pr-1">
          {questions.map((q) => {
            const expanded = expandedCards.has(q.question_number);
            const stemText = stripHtml(q.stem_html);
            const answer = formatAnswer(q);
            const hasWarning = warnings.some((w) => w.startsWith(`Q${q.question_number}:`));
            const optionImages = [q.option_1_image, q.option_2_image, q.option_3_image, q.option_4_image];
            const options = [q.option_1, q.option_2, q.option_3, q.option_4]
              .map((text, i) => ({ text, image: optionImages[i] }))
              .filter((o) => o.text || o.image);
            const imageCount = q.images?.length ?? 0;

            return (
              <div
                key={q.question_number}
                className="rounded-xl border border-border bg-background overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCard(q.question_number)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-bold text-muted-foreground">
                    {q.question_number}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TYPE_COLOUR[q.type]}`}>
                        {TYPE_LABEL[q.type]}
                      </span>
                      {q.topic && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                          {q.topic}
                        </span>
                      )}
                      {hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      {imageCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <ImageIcon className="h-3 w-3" /> {imageCount}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Answer: <span className="font-semibold text-foreground">{answer}</span>
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                      {stemText || <em className="text-muted-foreground">No stem text</em>}
                    </p>
                    {/<img/i.test(q.stem_html ?? "") && (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
                        <ImageIcon className="h-3 w-3" /> image
                      </span>
                    )}
                  </div>
                  <span className="mt-1 shrink-0 text-muted-foreground">
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 text-xs">

                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Question</p>
                      <LatexRenderer html={q.stem_html} className="text-xs [&_img]:hidden" />
                    </div>

                    {options.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Options</p>
                        <div className="grid grid-cols-2 gap-1">
                          {options.map((opt, i) => {
                            const num = i + 1;
                            const isCorrect = q.correct_options?.includes(num);
                            return (
                              <div key={i} className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-muted/30"}`}>
                                <span className={`shrink-0 font-bold ${isCorrect ? "text-green-600" : "text-muted-foreground"}`}>({num})</span>
                                <div className="flex-1 min-w-0">
                                  {opt.text && <LatexRenderer html={opt.text} inline className={`text-xs ${isCorrect ? "text-green-700" : "text-foreground"}`} />}
                                  {opt.image && <img src={opt.image} alt={`Option ${num}`} className={`mt-1 max-h-16 w-auto rounded object-contain ${isCorrect ? "ring-1 ring-green-400" : ""}`} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.type === "match_column" && q.match_col1 && q.match_col2 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Match Columns</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground">Column A</p>
                            {q.match_col1.map((e) => <div key={e.key} className="rounded bg-muted/30 px-2 py-1">({e.key}) {e.value}</div>)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground">Column B</p>
                            {q.match_col2.map((e) => <div key={e.key} className="rounded bg-muted/30 px-2 py-1">({e.key}) {e.value}</div>)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Answer</span>
                      <span className="rounded bg-green-50 border border-green-200 px-2 py-0.5 font-semibold text-green-700">{answer}</span>
                    </div>

                    {q.solution_html && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Solution</p>
                        <LatexRenderer html={q.solution_html} className="text-xs [&_img]:hidden" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm &amp; Import
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Render: upload form ───────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-black font-display text-foreground">Upload Test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a .docx file — questions, options, answers and solutions are detected automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            Test Paper Name
          </label>
          <input
            type="text"
            value={paperName}
            onChange={(e) => setPaperName(e.target.value)}
            placeholder="e.g. JEE Main 2024 – Chemistry Paper 1"
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Subject
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          >
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Exam Duration (minutes)
          </label>
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Associate with Course
          </label>
          <select
            value={courseId ?? ""}
            onChange={(e) => setCourseId(e.target.value || null)}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          >
            <option value="">Standalone (Free / no course)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Question Paper (.docx)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !busy && fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
              busy
                ? "cursor-not-allowed opacity-50 border-border"
                : file
                ? "border-secondary/60 bg-secondary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-secondary" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Click to select a .docx file</p>
                  <p className="text-xs text-muted-foreground">
                    MS Word format only · Max 20 MB · Images extracted and saved to storage.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {busy && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "creating" && "Creating paper record…"}
            {status === "parsing" && "Parsing document — extracting questions and images…"}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !file}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Working…</>
          ) : (
            <><Upload className="h-4 w-4" /> Upload &amp; Parse</>
          )}
        </button>
      </form>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">Supported question types (auto-detected from answer line)</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li><span className="font-semibold text-foreground">SCQ</span> — answer like <code>Answer: (3)</code></li>
          <li><span className="font-semibold text-foreground">MCQ</span> — answer like <code>Answer: (1), (2) and (3)</code></li>
          <li><span className="font-semibold text-foreground">Integer</span> — answer is a pure number, e.g. <code>Answer: 4</code></li>
          <li><span className="font-semibold text-foreground">Match the column</span> — bordered table with Column A / Column B headers</li>
          <li><span className="font-semibold text-foreground">Assertion-Reasoning</span> — stem contains both "Assertion" and "Reason"</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          Questions must be bold-numbered <strong>(e.g. "1.")</strong> at the start of each paragraph.
          Embedded images (graphs, diagrams) are uploaded to Storage and rendered inline.
        </p>
      </div>
    </div>
  );
};

export default AdminUploadQuestionsPage;
