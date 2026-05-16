import { useState, useRef } from "react";
import { Upload, Download, X, FileText, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Check, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export type BulkUploadMode = "question_bank" | "compete";

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  mode?: BulkUploadMode;
};

const QB_HEADERS = [
  "subject",
  "topic",
  "difficulty",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "explanation",
  "marks_correct",
  "marks_wrong",
  "tags",
];

const COMPETE_HEADERS = [
  "subject",
  "topic",
  "difficulty",
  "target_exam",
  "class_level",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "explanation",
];

const QB_SAMPLE_ROWS: string[][] = [
  [
    "Physics", "Kinematics", "easy",
    "What is the SI unit of acceleration?",
    "m/s", "m/s^2", "m^2/s", "kg.m/s",
    "2",
    "Acceleration = change in velocity per unit time, so units are m/s².",
    "4", "-1", "units;basics",
  ],
  [
    "Mathematics", "Algebra", "medium",
    "Solve for x: $2x + 6 = 14$",
    "2", "4", "6", "8",
    "2",
    "2x = 8 so x = 4.",
    "4", "-1", "linear-equations",
  ],
  [
    "Chemistry", "Periodic Table", "hard",
    "Which of the following are noble gases? (Select all that apply)",
    "Helium", "Nitrogen", "Argon", "Oxygen",
    "1,3",
    "Helium and Argon belong to group 18 (noble gases).",
    "4", "-1", "noble-gases;multi-select",
  ],
];

const COMPETE_SAMPLE_ROWS: string[][] = [
  [
    "Physics", "Kinematics", "easy", "JEE Main", "11",
    "What is the SI unit of acceleration?",
    "m/s", "m/s^2", "m^2/s", "kg.m/s",
    "2",
    "Acceleration = change in velocity per unit time, so units are m/s².",
  ],
  [
    "Math", "Algebra", "medium", "JEE Main", "11",
    "Solve for x: $2x + 6 = 14$",
    "2", "4", "6", "8",
    "2",
    "Subtracting 6 then dividing by 2 gives x = 4.",
  ],
  [
    "Chemistry", "Thermodynamics", "hard", "NEET", "12",
    "For an ideal gas at constant T, $\\Delta U$ equals?",
    "0", "nRT", "nC_vT", "PV",
    "1",
    "Internal energy of an ideal gas depends only on T; isothermal => ΔU = 0.",
  ],
];

// --- CSV helpers (RFC 4180-ish) ---
const csvEscape = (v: string | number | null | undefined) => {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const getHeadersFor = (mode: BulkUploadMode) =>
  mode === "compete" ? COMPETE_HEADERS : QB_HEADERS;

const getSamplesFor = (mode: BulkUploadMode) =>
  mode === "compete" ? COMPETE_SAMPLE_ROWS : QB_SAMPLE_ROWS;

const buildTemplate = (mode: BulkUploadMode) => {
  const headers = getHeadersFor(mode);
  const rows = [headers, ...getSamplesFor(mode)];
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
};

const downloadCSV = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
};

type ParsedQuestion = {
  subject: string;
  topic: string | null;
  difficulty: string;
  question_text: string;
  options: { id: number; text: string }[];
  correct_answer: number | number[];
  explanation: string | null;
  marks_correct: number;
  marks_wrong: number;
  tags: string[];
  is_public: boolean;
  created_by: string | null;
  target_exam?: string | null;
  class_level?: string | null;
};

type RowError = { row: number; message: string; raw: string[] };

import { SUBJECTS, SUBJECTS_VALID_ANY } from "@/lib/constants";
const VALID_SUBJECTS_QB: string[] = [...SUBJECTS];
const VALID_SUBJECTS_COMPETE: string[] = [...SUBJECTS_VALID_ANY];
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

const parseRow = (
  headers: string[],
  row: string[],
  userId: string | null,
  mode: BulkUploadMode,
): ParsedQuestion => {
  const get = (k: string) => {
    const idx = headers.indexOf(k);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  const validSubjects = mode === "compete" ? VALID_SUBJECTS_COMPETE : VALID_SUBJECTS_QB;
  const subject = get("subject");
  if (!validSubjects.includes(subject)) {
    throw new Error(`Invalid subject "${subject}" (allowed: ${validSubjects.join(", ")})`);
  }

  const difficulty = (get("difficulty") || "medium").toLowerCase();
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    throw new Error(`Invalid difficulty "${difficulty}" (allowed: easy, medium, hard)`);
  }

  const question_text = get("question_text");
  if (!question_text) throw new Error("question_text is required");

  const opts = [get("option_a"), get("option_b"), get("option_c"), get("option_d")];
  const options = opts
    .map((text, i) => ({ id: i + 1, text }))
    .filter((o) => o.text.length > 0);
  if (options.length < 2) throw new Error("At least 2 options are required");

  const rawCorrect = get("correct_answer");
  if (!rawCorrect) throw new Error("correct_answer is required");
  const correctIdxs = rawCorrect.split(/[,;|]/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (!correctIdxs.length) throw new Error(`Invalid correct_answer "${rawCorrect}" (use 1-4, comma-separated for multi)`);
  for (const c of correctIdxs) {
    if (c < 1 || c > options.length) throw new Error(`correct_answer ${c} out of range (1-${options.length})`);
  }
  if (mode === "compete" && correctIdxs.length > 1) {
    throw new Error("Compete questions support only a single correct_answer");
  }
  const correct_answer: number | number[] = correctIdxs.length === 1 ? correctIdxs[0] : correctIdxs;

  const marksC = parseFloat(get("marks_correct"));
  const marksW = parseFloat(get("marks_wrong"));
  const tagsRaw = get("tags");
  const tags = tagsRaw ? tagsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [];

  return {
    subject,
    topic: get("topic") || null,
    difficulty,
    question_text,
    options,
    correct_answer,
    explanation: get("explanation") || null,
    marks_correct: isNaN(marksC) ? 4 : marksC,
    marks_wrong: isNaN(marksW) ? -1 : marksW,
    tags,
    is_public: true,
    created_by: userId,
    target_exam: get("target_exam") || null,
    class_level: get("class_level") || null,
  };
};

type Step = "upload" | "preview" | "importing" | "done";
type DuplicateMode = "insert" | "skip" | "upsert";
const PAGE_SIZE = 25;

const normalizeText = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const BulkQuestionUploadDialog = ({ open, onClose, onUploaded, mode = "question_bank" }: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [insertedCount, setInsertedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [insertErrors, setInsertErrors] = useState<RowError[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("insert");
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);

  const tableName = mode === "compete" ? "compete_questions" : "question_bank";
  const headersForMode = getHeadersFor(mode);

  if (!open) return null;

  const reset = () => {
    setStep("upload");
    setParsed([]);
    setErrors([]);
    setFileName("");
    setProgress({ done: 0, total: 0 });
    setInsertedCount(0);
    setUpdatedCount(0);
    setSkippedCount(0);
    setInsertErrors([]);
    setPreviewSearch("");
    setPreviewPage(1);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    if (step === "importing") return;
    reset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const filename = mode === "compete" ? "compete-questions-template.csv" : "question-bank-template.csv";
    downloadCSV(filename, buildTemplate(mode));
  };

  const handleDownloadErrors = (rows: RowError[]) => {
    const headers = ["row_number", "error_message", ...headersForMode];
    const lines = [headers.map(csvEscape).join(",")];
    for (const e of rows) {
      const cells = [String(e.row), e.message, ...headersForMode.map((_, i) => e.raw[i] ?? "")];
      lines.push(cells.map(csvEscape).join(","));
    }
    downloadCSV("import-errors.csv", lines.join("\n"));
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    setErrors([]);
    setParsed([]);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast.error("CSV is empty or has only headers");
        return;
      }
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const missing = ["subject", "question_text", "correct_answer"].filter((h) => !headers.includes(h));
      if (missing.length) {
        toast.error(`Missing required columns: ${missing.join(", ")}`);
        return;
      }

      const headerIndex = (h: string) => headers.indexOf(h);
      const reorderRaw = (r: string[]) =>
        headersForMode.map((h) => {
          const idx = headerIndex(h);
          return idx >= 0 ? (r[idx] ?? "") : "";
        });

      const ok: ParsedQuestion[] = [];
      const bad: RowError[] = [];
      for (let i = 1; i < rows.length; i++) {
        try {
          ok.push(parseRow(headers, rows[i], user?.id ?? null, mode));
        } catch (e: any) {
          bad.push({ row: i + 1, message: e.message, raw: reorderRaw(rows[i]) });
        }
      }
      setParsed(ok);
      setErrors(bad);
      setStep("preview");
    } catch (e: any) {
      toast.error(e.message || "Failed to read CSV");
    } finally {
      setParsing(false);
    }
  };

  const toCompetePayload = (row: ParsedQuestion) => {
    const correctIdx = Array.isArray(row.correct_answer) ? row.correct_answer[0] : row.correct_answer;
    return {
      subject: row.subject,
      topic: row.topic ?? "",
      difficulty: row.difficulty,
      target_exam: row.target_exam ?? null,
      class_level: row.class_level ?? null,
      question_text: row.question_text,
      options: row.options.map((o) => o.text),
      correct_index: correctIdx - 1,
      explanation: row.explanation,
      is_active: true,
      created_by: row.created_by,
    };
  };

  const toQbPayload = (row: ParsedQuestion) => row;

  const buildPayload = (row: ParsedQuestion) =>
    mode === "compete" ? toCompetePayload(row) : toQbPayload(row);

  const handleConfirmImport = async () => {
    if (!parsed.length) return;
    setStep("importing");
    setProgress({ done: 0, total: parsed.length });
    const BATCH = 50;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const insErrors: RowError[] = [];

    const existing = new Map<string, string>();
    if (duplicateMode !== "insert") {
      const subjects = Array.from(new Set(parsed.map((p) => p.subject)));
      const { data: existingRows, error: fetchErr } = await (supabase as any)
        .from(tableName)
        .select("id, subject, question_text")
        .in("subject", subjects);
      if (fetchErr) {
        toast.error(`Couldn't check duplicates: ${fetchErr.message}`);
        setStep("preview");
        return;
      }
      for (const r of existingRows ?? []) {
        existing.set(`${r.subject}::${normalizeText(r.question_text)}`, r.id);
      }
    }

    for (let i = 0; i < parsed.length; i += BATCH) {
      const chunk = parsed.slice(i, i + BATCH);

      const toInsert: ParsedQuestion[] = [];
      const toUpdate: { id: string; row: ParsedQuestion; index: number }[] = [];

      chunk.forEach((row, idx) => {
        const key = `${row.subject}::${normalizeText(row.question_text)}`;
        const existingId = existing.get(key);
        if (!existingId || duplicateMode === "insert") {
          toInsert.push(row);
        } else if (duplicateMode === "skip") {
          skipped += 1;
        } else if (duplicateMode === "upsert") {
          toUpdate.push({ id: existingId, row, index: idx });
        }
      });

      if (toInsert.length) {
        const payloads = toInsert.map(buildPayload);
        const { data: insertedRows, error } = await (supabase as any)
          .from(tableName)
          .insert(payloads as any)
          .select("id, subject, question_text");
        if (error) {
          for (let j = 0; j < toInsert.length; j++) {
            insErrors.push({ row: i + j + 2, message: `Insert failed: ${error.message}`, raw: [] });
          }
        } else {
          inserted += toInsert.length;
          for (const r of insertedRows ?? []) {
            existing.set(`${r.subject}::${normalizeText(r.question_text)}`, r.id);
          }
        }
      }

      for (const u of toUpdate) {
        const { error } = await (supabase as any)
          .from(tableName)
          .update(buildPayload(u.row) as any)
          .eq("id", u.id);
        if (error) {
          insErrors.push({ row: i + u.index + 2, message: `Update failed: ${error.message}`, raw: [] });
        } else {
          updated += 1;
        }
      }

      setProgress({ done: Math.min(i + chunk.length, parsed.length), total: parsed.length });
      await new Promise((r) => setTimeout(r, 0));
    }

    setInsertedCount(inserted);
    setUpdatedCount(updated);
    setSkippedCount(skipped);
    setInsertErrors(insErrors);
    setStep("done");
    const totalChanged = inserted + updated;
    if (totalChanged > 0) {
      toast.success(`Imported ${inserted} new${updated ? `, updated ${updated}` : ""}${skipped ? `, skipped ${skipped}` : ""}`);
      onUploaded();
    } else if (skipped > 0) {
      toast.info(`All ${skipped} rows already existed — none imported`);
    }
    if (insErrors.length) toast.warning(`${insErrors.length} row${insErrors.length === 1 ? "" : "s"} failed`);
  };

  const renderCorrect = (q: ParsedQuestion) => {
    const arr = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
    return arr.map((n) => String.fromCharCode(64 + n)).join(", ");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-4xl rounded-2xl bg-card border border-border shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2"><Upload className="h-4 w-4 text-primary" /></div>
            <div>
              <h2 className="text-base font-bold text-foreground">Bulk upload questions</h2>
              <p className="text-xs text-muted-foreground">
                {step === "upload" && "Import multiple questions from a CSV file"}
                {step === "preview" && `Preview · ${fileName}`}
                {step === "importing" && "Importing… please don't close this window"}
                {step === "done" && "Import complete"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={step === "importing"}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={step === "upload" ? "text-primary" : ""}>1 · Upload</span>
          <span>›</span>
          <span className={step === "preview" ? "text-primary" : ""}>2 · Preview</span>
          <span>›</span>
          <span className={step === "importing" ? "text-primary" : ""}>3 · Import</span>
          <span>›</span>
          <span className={step === "done" ? "text-primary" : ""}>4 · Done</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === "upload" && (
            <>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-sm font-semibold text-foreground mb-2">Step 1 · Download the template</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Get a CSV template with the correct headers and sample rows (including LaTeX and multi-select examples).
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                >
                  <Download className="h-3.5 w-3.5" /> Download CSV template
                </button>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-sm font-semibold text-foreground mb-2">Step 2 · Upload your filled CSV</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Required columns: <code className="px-1 rounded bg-background">subject</code>,{" "}
                  <code className="px-1 rounded bg-background">question_text</code>,{" "}
                  <code className="px-1 rounded bg-background">correct_answer</code>. Multi-correct answers: comma-separate (e.g. <code className="px-1 rounded bg-background">1,3</code>). Tags use <code className="px-1 rounded bg-background">;</code> separator.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <button
                  disabled={parsing}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  {parsing ? "Parsing…" : "Choose CSV file"}
                </button>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Valid rows</div>
                  <div className="text-xl font-bold text-emerald-700">{parsed.length}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Invalid rows</div>
                    <div className="text-xl font-bold text-rose-700">{errors.length}</div>
                  </div>
                  {errors.length > 0 && (
                    <button
                      onClick={() => handleDownloadErrors(errors)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Download className="h-3.5 w-3.5" /> Errors CSV
                    </button>
                  )}
                </div>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 mb-2">
                    <AlertCircle className="h-4 w-4" /> First {Math.min(errors.length, 5)} validation issues
                  </div>
                  <ul className="space-y-1 text-xs text-rose-700">
                    {errors.slice(0, 5).map((e, i) => (
                      <li key={i}>Row {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.length > 0 && (() => {
                const filtered = previewSearch.trim()
                  ? parsed
                      .map((q, idx) => ({ q, idx }))
                      .filter(({ q }) => {
                        const s = previewSearch.toLowerCase();
                        return (
                          q.question_text.toLowerCase().includes(s) ||
                          q.subject.toLowerCase().includes(s) ||
                          (q.topic ?? "").toLowerCase().includes(s) ||
                          q.difficulty.toLowerCase().includes(s)
                        );
                      })
                  : parsed.map((q, idx) => ({ q, idx }));
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const page = Math.min(previewPage, totalPages);
                const start = (page - 1) * PAGE_SIZE;
                const pageRows = filtered.slice(start, start + PAGE_SIZE);
                return (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">
                        Preview · {filtered.length} of {parsed.length} valid rows
                      </span>
                      <div className="flex-1" />
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          value={previewSearch}
                          onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(1); }}
                          placeholder="Search rows…"
                          className="bg-transparent text-xs outline-none w-44"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[40vh]">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left">CSV row</th>
                            <th className="px-2 py-2 text-left">Subject</th>
                            <th className="px-2 py-2 text-left">Topic</th>
                            <th className="px-2 py-2 text-left">Diff.</th>
                            <th className="px-2 py-2 text-left">Question</th>
                            <th className="px-2 py-2 text-left">Options</th>
                            <th className="px-2 py-2 text-left">Correct</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.length === 0 ? (
                            <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">No rows match your search.</td></tr>
                          ) : pageRows.map(({ q, idx }) => (
                            <tr key={idx} className="border-t border-border align-top">
                              <td className="px-2 py-2 text-muted-foreground">{idx + 2}</td>
                              <td className="px-2 py-2 font-semibold">{q.subject}</td>
                              <td className="px-2 py-2 text-muted-foreground">{q.topic ?? "—"}</td>
                              <td className="px-2 py-2 capitalize">{q.difficulty}</td>
                              <td className="px-2 py-2 max-w-[260px] truncate" title={q.question_text}>{q.question_text}</td>
                              <td className="px-2 py-2 text-muted-foreground">{q.options.length}</td>
                              <td className="px-2 py-2 font-semibold text-emerald-700">{renderCorrect(q)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-t border-border text-xs">
                      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPreviewPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" /> Prev
                        </button>
                        <button
                          onClick={() => setPreviewPage(Math.min(totalPages, page + 1))}
                          disabled={page >= totalPages}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          Next <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Duplicate handling */}
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-xs font-semibold text-foreground mb-2">If a question already exists in the bank…</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { id: "insert", label: "Insert anyway", desc: "Create new rows even if duplicates exist." },
                    { id: "skip", label: "Skip duplicates", desc: "Only insert questions that don't already exist." },
                    { id: "upsert", label: "Update existing", desc: "Overwrite the existing question with CSV data." },
                  ] as const).map((opt) => (
                    <label
                      key={opt.id}
                      className={`cursor-pointer rounded-lg border p-2.5 transition-all ${duplicateMode === opt.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}
                    >
                      <input
                        type="radio"
                        name="dup-mode"
                        className="sr-only"
                        checked={duplicateMode === opt.id}
                        onChange={() => setDuplicateMode(opt.id)}
                      />
                      <div className="text-xs font-bold text-foreground">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                    </label>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  Duplicates are detected by matching <strong>subject</strong> + <strong>question text</strong> (case &amp; whitespace-insensitive).
                </div>
              </div>
            </>
          )}

          {step === "importing" && (
            <div className="space-y-4 py-6">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Importing {progress.done} / {progress.total} questions…
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}% complete
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-3">
              {(insertedCount > 0 || updatedCount > 0 || skippedCount > 0) && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-semibold">Import complete</div>
                    <div>
                      Inserted {insertedCount}
                      {updatedCount > 0 && ` · Updated ${updatedCount}`}
                      {skippedCount > 0 && ` · Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}`}
                    </div>
                  </div>
                </div>
              )}
              {(errors.length > 0 || insertErrors.length > 0) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                      <AlertCircle className="h-4 w-4" />
                      {errors.length + insertErrors.length} row{errors.length + insertErrors.length === 1 ? "" : "s"} skipped or failed
                    </div>
                    <button
                      onClick={() => handleDownloadErrors([...errors, ...insertErrors])}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Download className="h-3.5 w-3.5" /> Download errors CSV
                    </button>
                  </div>
                  <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-rose-700">
                    {[...errors, ...insertErrors].slice(0, 20).map((e, i) => (
                      <li key={i}>Row {e.row}: {e.message}</li>
                    ))}
                    {(errors.length + insertErrors.length) > 20 && (
                      <li className="italic">…and {errors.length + insertErrors.length - 20} more (download CSV for full list)</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 p-4 border-t border-border">
          {step === "preview" ? (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Choose different file
            </button>
          ) : <div />}

          <div className="flex gap-2">
            {step === "preview" && (
              <button
                onClick={handleConfirmImport}
                disabled={parsed.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Confirm import ({parsed.length})
              </button>
            )}
            {step === "done" && (
              <button
                onClick={reset}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Import another file
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={step === "importing"}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
            >
              {step === "done" ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkQuestionUploadDialog;
