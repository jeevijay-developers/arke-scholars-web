import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Target,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcPercent } from "@/lib/progress";
import MathRenderer from "@/components/MathRenderer";

const slugifySubject = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";

type Question = {
  id: string;
  subject: string | null;
  question_text: string;
  options: { id: number; text: string }[] | unknown;
  correct_answer: number;
  marks_correct: number | null;
  marks_wrong: number | null;
  explanation: string | null;
};

const TestSubjectBreakdownPage = () => {
  const { attemptId, slug, subject } = useParams<{
    attemptId: string;
    slug: string;
    subject: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected: number | null }>>({});
  const [subjectName, setSubjectName] = useState<string>(subject ?? "");
  const [testName, setTestName] = useState<string>("");

  useEffect(() => {
    if (!attemptId || !subject) return;
    let cancelled = false;
    (async () => {
      const { data: att } = await supabase
        .from("test_attempts")
        .select("test_id, test_name, answers")
        .eq("id", attemptId)
        .maybeSingle();
      if (cancelled || !att?.test_id) {
        setLoading(false);
        return;
      }
      setTestName(att.test_name ?? "");
      setAnswers((att.answers ?? {}) as Record<string, { selected: number | null }>);

      const { data: qs } = await supabase
        .from("test_questions")
        .select("id, subject, question_text, options, correct_answer, marks_correct, marks_wrong, explanation")
        .eq("test_id", att.test_id);
      if (cancelled) return;
      const filtered = (qs ?? []).filter((q) => slugifySubject(q.subject ?? "General") === subject);
      if (filtered.length > 0) setSubjectName(filtered[0].subject ?? "General");
      setQuestions(filtered as Question[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, subject]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const total = questions.length;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  let score = 0;
  questions.forEach((q) => {
    const sel = answers[q.id]?.selected;
    if (sel == null) unattempted += 1;
    else if (sel === q.correct_answer) {
      correct += 1;
      score += Number(q.marks_correct ?? 4);
    } else {
      wrong += 1;
      score += Number(q.marks_wrong ?? -1);
    }
  });
  const acc = calcPercent(correct, correct + wrong);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-6">
      <Link
        to={`/tests/${slug}/result/${attemptId}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to result
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{testName}</p>
        <h1 className="font-display text-2xl font-black text-foreground">{subjectName}</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total" value={total} />
          <Stat label="Correct" value={correct} tone="success" />
          <Stat label="Wrong" value={wrong} tone="danger" />
          <Stat label="Skipped" value={unattempted} />
          <Stat label="Accuracy" value={`${acc}%`} tone="primary" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Marks scored: <span className="font-bold text-foreground">{score.toFixed(1)}</span></p>
      </div>

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const sel = answers[q.id]?.selected;
          const isCorrect = sel === q.correct_answer;
          const isUnattempted = sel == null;
          const opts = (Array.isArray(q.options) ? q.options : []) as { id: number; text: string }[];
          return (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-4 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-foreground flex-1">
                  <span className="mr-1">Q{idx + 1}.</span>
                  <MathRenderer content={q.question_text} inline />
                </div>
                {isUnattempted ? (
                  <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {opts.map((opt) => {
                  const isAns = opt.id === q.correct_answer;
                  const isSel = opt.id === sel;
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        isAns
                          ? "border-secondary bg-secondary/10 text-foreground"
                          : isSel
                          ? "border-destructive bg-destructive/10 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <span className="mr-2 font-bold">{String.fromCharCode(65 + opt.id)}.</span>
                      <MathRenderer content={opt.text} inline />
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">Explanation: </span>
                  <MathRenderer content={q.explanation} inline />
                </div>
              )}
            </div>
          );
        })}
        {questions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Target className="mx-auto mb-2 h-6 w-6" />
            No questions found for this subject.
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "danger" | "primary";
}) => {
  const toneCls =
    tone === "success"
      ? "text-secondary"
      : tone === "danger"
      ? "text-destructive"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <p className={`font-display text-xl font-black ${toneCls}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
};

export default TestSubjectBreakdownPage;
