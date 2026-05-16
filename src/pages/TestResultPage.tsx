import { useEffect, useState } from "react";
import {
  Trophy,
  Target,
  TrendingUp,
  RotateCcw,
  Home,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Award,
  ChevronRight,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { calcPercent } from "@/lib/progress";

const slugifySubject = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";


type SubjectStat = { total: number; correct: number; attempted: number; score: number };

type Attempt = {
  id: string;
  test_name: string;
  score: number | null;
  total_questions: number | null;
  correct_answers: number | null;
  percentile: number | null;
  time_spent_seconds: number | null;
  test_id: string | null;
  answers: Record<string, { selected: number | null }> | null;
};

const TestResultPage = () => {
  const { attemptId: id, slug } = useParams<{ attemptId: string; slug: string }>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [subjects, setSubjects] = useState<Record<string, SubjectStat>>({});


  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("test_attempts")
        .select(
          "id, test_name, score, total_questions, correct_answers, percentile, time_spent_seconds, test_id, answers",
        )
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setLoading(false);
        return;
      }
      setAttempt(data as Attempt);

      if (data.test_id) {
        const { data: qs } = await supabase
          .from("test_questions")
          .select("id, subject, correct_answer, marks_correct, marks_wrong")
          .eq("test_id", data.test_id);
        const ans = (data.answers ?? {}) as Record<string, { selected: number | null }>;
        const breakdown: Record<string, SubjectStat> = {};
        (qs ?? []).forEach((q) => {
          const subj = q.subject ?? "General";
          if (!breakdown[subj]) breakdown[subj] = { total: 0, correct: 0, attempted: 0, score: 0 };
          breakdown[subj].total += 1;
          const sel = ans[q.id]?.selected;
          if (sel != null) {
            breakdown[subj].attempted += 1;
            if (q.correct_answer === sel) {
              breakdown[subj].correct += 1;
              breakdown[subj].score += Number(q.marks_correct ?? 4);
            } else {
              breakdown[subj].score += Number(q.marks_wrong ?? -1);
            }
          }
        });
        if (!cancelled) setSubjects(breakdown);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!attempt) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Result not found.</div>;
  }

  const total = Number(attempt.total_questions ?? 0);
  const correct = Number(attempt.correct_answers ?? 0);
  const score = Number(attempt.score ?? 0);
  const answersMap = (attempt.answers ?? {}) as Record<string, { selected: number | null }>;
  const attempted = Object.values(answersMap).filter((a) => a?.selected != null).length;
  const wrong = Math.max(0, attempted - correct);
  const unattempted = Math.max(0, total - attempted);
  const accuracy = calcPercent(correct, attempted || total);
  const percentile = attempt.percentile != null ? Number(attempt.percentile) : null;
  const seconds = Number(attempt.time_spent_seconds ?? 0);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  const performanceLabel =
    accuracy >= 80 ? "Excellent" : accuracy >= 60 ? "Good" : accuracy >= 40 ? "Keep going" : "Needs work";

  return (
    <div className="pb-20 lg:pb-0">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-8 text-center">
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative">
          <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
            <Award className="h-3.5 w-3.5" /> {performanceLabel}
          </div>
          <h1 className="font-display text-2xl font-black text-white">{attempt.test_name}</h1>
          <p className="mt-1 text-xs text-white/80">Test submitted successfully</p>

          <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <Trophy className="mx-auto mb-1 h-5 w-5 text-white" />
              <p className="text-xl font-black text-white">{score.toFixed(1)}</p>
              <p className="text-[10px] text-white/80">Score</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <Target className="mx-auto mb-1 h-5 w-5 text-white" />
              <p className="text-xl font-black text-white">{accuracy}%</p>
              <p className="text-[10px] text-white/80">Accuracy</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <TrendingUp className="mx-auto mb-1 h-5 w-5 text-white" />
              <p className="text-xl font-black text-white">{percentile != null ? `${percentile}%` : "—"}</p>
              <p className="text-[10px] text-white/80">Percentile</p>
            </div>
          </div>

          <p className="mt-3 inline-flex items-center gap-1 text-xs text-white/80">
            <Clock className="h-3 w-3" /> Completed in {minutes}m {secs}s
          </p>
        </div>
      </div>

      <div className="space-y-5 p-4 lg:p-6">
        {/* Question stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={CheckCircle2} label="Correct" value={correct} tone="success" />
          <StatTile icon={XCircle} label="Wrong" value={wrong} tone="danger" />
          <StatTile icon={MinusCircle} label="Unattempted" value={unattempted} tone="muted" />
          <StatTile icon={Target} label="Total" value={total} tone="primary" />
        </div>

        {/* Subject breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold text-foreground">Subject-wise Breakdown</h2>
          {Object.keys(subjects).length === 0 ? (
            <p className="text-xs text-muted-foreground">No subject data available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(subjects).map(([subj, stat]) => {
                const acc = calcPercent(stat.correct, stat.attempted || stat.total);
                const subjSlug = slugifySubject(subj);
                return (
                  <Link
                    key={subj}
                    to={`/tests/${slug}/result/${id}/subject/${subjSlug}`}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <CircularProgress value={acc} />
                    <div className="text-center">
                      <p className="flex items-center justify-center gap-0.5 text-xs font-bold text-foreground group-hover:text-primary">
                        {subj}
                        <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {stat.correct}/{stat.total} · {Number(stat.score).toFixed(1)}m
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/my-tests"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Back to Tests
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Home className="h-3.5 w-3.5" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "success" | "danger" | "muted" | "primary";
}) => {
  const tones: Record<string, string> = {
    success: "bg-secondary/10 text-secondary",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className={`mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
};

const CircularProgress = ({ value, size = 64, stroke = 6 }: { value: number; size?: number; stroke?: number }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(100, Math.max(0, value));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setAnimated(target), 50);
    return () => window.clearTimeout(t);
  }, [target]);

  const offset = circumference - (animated / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
          className="fill-none stroke-primary"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-foreground">
        {Math.round(animated)}%
      </div>
    </div>
  );
};

export default TestResultPage;
