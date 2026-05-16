import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Upload, Loader2, CalendarDays, BookOpen, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUBJECTS } from "@/lib/constants";

const AdminUploadQuestionsPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [examDate, setExamDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "parsing">("idle");

  const busy = status !== "idle";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) { toast.error("Paper code is required"); return; }
    if (!file) { toast.error("Please select a .docx file"); return; }

    try {
      // ── Step 1: Insert paper record ────────────────────────────────────────
      setStatus("creating");
      const { data: paper, error: paperErr } = await (supabase as any)
        .from("papers")
        .insert({
          code: code.trim(),
          subject,
          exam_date: examDate || null,
        })
        .select("id")
        .single();

      if (paperErr) throw new Error(paperErr.message);
      const paperId: string = paper.id;

      // ── Step 2: Call edge function to parse the docx ───────────────────────
      setStatus("parsing");
      const form = new FormData();
      form.append("file", file);
      form.append("paper_id", paperId);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-docx`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error ?? "Parse failed");
      }

      const { questions } = await res.json();

      if (!questions || questions.length === 0) {
        toast.warning("No questions were detected in the document. Check the file format.");
        navigate(`/admin/review-questions/${paperId}`, {
          state: { questions: [], paperId, paperCode: code },
        });
        return;
      }

      toast.success(`Parsed ${questions.length} question${questions.length === 1 ? "" : "s"}`);
      navigate(`/admin/review-questions/${paperId}`, {
        state: { questions, paperId, paperCode: code },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setStatus("idle");
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black font-display text-foreground">Upload Question Paper</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a .docx file — equations, images, and question types are detected automatically.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Paper code */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            Paper Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. FST-8"
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        {/* Subject */}
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
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Exam date */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            Exam Date <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        {/* File */}
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
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                    MS Word format only. Equations and images are extracted automatically.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status / submit */}
        {status !== "idle" && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "creating" && "Creating paper record…"}
            {status === "parsing" && "Parsing document — extracting questions, images and equations…"}
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

      {/* Format hints */}
      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">Supported question types (auto-detected)</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li><span className="font-semibold text-foreground">SCQ / MCQ</span> — paragraphs with options <code className="rounded bg-background px-1">(1)(2)(3)(4)</code></li>
          <li><span className="font-semibold text-foreground">Integer type</span> — numbered paragraph with no option block</li>
          <li><span className="font-semibold text-foreground">Match the column</span> — question followed by a Word table</li>
          <li><span className="font-semibold text-foreground">Assertion-Reasoning</span> — contains "Assertion" and "Reason" keywords</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          Questions numbered <strong>in bold</strong> at the start of each paragraph.
          Word equation-editor (OMML) formulas are flagged for manual LaTeX entry during review.
        </p>
      </div>
    </div>
  );
};

export default AdminUploadQuestionsPage;
