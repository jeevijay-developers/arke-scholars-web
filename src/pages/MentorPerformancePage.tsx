import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, BookOpen, ClipboardCheck, MessageCircle, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type Student = {
  user_id: string;
  full_name: string | null;
  target_exam: string | null;
  class_level: string | null;
};

type Attempt = {
  user_id: string;
  score: number | null;
  total_questions: number | null;
  correct_answers: number | null;
  attempted_at: string | null;
};

type Enrollment = {
  user_id: string;
  progress_percent: number | null;
  is_active: boolean | null;
  last_accessed_at: string | null;
};

type Doubt = { user_id: string; status: string | null };

type Row = {
  student: Student;
  attempts: number;
  avgScore: number | null;
  bestScore: number | null;
  lastAttempt: string | null;
  activeCourses: number;
  avgProgress: number | null;
  openDoubts: number;
};

const fmtPct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—";

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "secondary" | "success";
}) => {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-600"
      : tone === "secondary"
      ? "bg-secondary/15 text-secondary"
      : "bg-primary/15 text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-black text-foreground">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
};

const MentorPerformancePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: assignments } = await supabase
        .from("mentor_student_assignments")
        .select("student_id")
        .eq("mentor_id", user.id)
        .is("removed_at", null);
      const ids = (assignments ?? []).map((a) => a.student_id);

      if (!ids.length) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const [studentsRes, attemptsRes, enrollmentsRes, doubtsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, target_exam, class_level")
          .in("user_id", ids),
        supabase
          .from("test_attempts")
          .select("user_id, score, total_questions, correct_answers, attempted_at")
          .in("user_id", ids),
        supabase
          .from("enrollments")
          .select("user_id, progress_percent, is_active, last_accessed_at")
          .in("user_id", ids),
        supabase.from("doubts").select("user_id, status").in("user_id", ids),
      ]);

      const students = (studentsRes.data ?? []) as Student[];
      const attempts = (attemptsRes.data ?? []) as Attempt[];
      const enrollments = (enrollmentsRes.data ?? []) as Enrollment[];
      const doubts = (doubtsRes.data ?? []) as Doubt[];

      const computed: Row[] = students.map((s) => {
        const a = attempts.filter((x) => x.user_id === s.user_id);
        const e = enrollments.filter((x) => x.user_id === s.user_id);
        const d = doubts.filter((x) => x.user_id === s.user_id);
        const scores = a.map((x) => Number(x.score ?? 0)).filter((n) => !Number.isNaN(n));
        const avgScore = scores.length ? scores.reduce((p, n) => p + n, 0) / scores.length : null;
        const bestScore = scores.length ? Math.max(...scores) : null;
        const lastAttempt = a
          .map((x) => x.attempted_at)
          .filter(Boolean)
          .sort((x, y) => new Date(x!).getTime() - new Date(y!).getTime())
          .at(-1) as string | null;
        const activeCourses = e.filter((x) => x.is_active !== false).length;
        const progresses = e
          .map((x) => Number(x.progress_percent ?? 0))
          .filter((n) => !Number.isNaN(n));
        const avgProgress = progresses.length
          ? progresses.reduce((p, n) => p + n, 0) / progresses.length
          : null;
        const openDoubts = d.filter((x) => x.status !== "answered").length;
        return {
          student: s,
          attempts: a.length,
          avgScore,
          bestScore,
          lastAttempt,
          activeCourses,
          avgProgress,
          openDoubts,
        };
      });

      if (!cancelled) {
        setRows(computed);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return { students: 0, avgScore: null as number | null, avgProgress: null as number | null, openDoubts: 0 };
    }
    const allScores = rows.map((r) => r.avgScore).filter((n): n is number => n != null);
    const allProgress = rows.map((r) => r.avgProgress).filter((n): n is number => n != null);
    return {
      students: rows.length,
      avgScore: allScores.length ? allScores.reduce((p, n) => p + n, 0) / allScores.length : null,
      avgProgress: allProgress.length ? allProgress.reduce((p, n) => p + n, 0) / allProgress.length : null,
      openDoubts: rows.reduce((p, r) => p + r.openDoubts, 0),
    };
  }, [rows]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-black text-foreground">Performance</h1>
        <p className="text-sm text-muted-foreground">
          Track how your assigned students are performing across tests, courses and doubts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Students" value={String(summary.students)} tone="primary" />
        <StatCard icon={TrendingUp} label="Avg Test Score" value={fmtPct(summary.avgScore)} tone="success" />
        <StatCard icon={BookOpen} label="Avg Course Progress" value={fmtPct(summary.avgProgress)} tone="secondary" />
        <StatCard icon={MessageCircle} label="Open Doubts" value={String(summary.openDoubts)} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Student-wise Performance</h2>
          </div>
          <Link to="/mentor/students" className="text-xs font-semibold text-primary hover:underline">
            View students →
          </Link>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading performance…</p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No students assigned yet. Once an admin assigns students to you, their performance will show up here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Tests</th>
                  <th className="px-4 py-3">Avg Score</th>
                  <th className="px-4 py-3">Best</th>
                  <th className="px-4 py-3">Last Test</th>
                  <th className="px-4 py-3">Courses</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Open Doubts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const initials = (r.student.full_name ?? "S")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("");
                  return (
                    <tr key={r.student.user_id} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/15 text-xs font-bold text-secondary">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {r.student.full_name || "Student"}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {[r.student.target_exam, r.student.class_level].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{r.attempts}</td>
                      <td className="px-4 py-3 text-foreground">{fmtPct(r.avgScore)}</td>
                      <td className="px-4 py-3 text-foreground">{fmtPct(r.bestScore)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.lastAttempt)}</td>
                      <td className="px-4 py-3 text-foreground">{r.activeCourses}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, r.avgProgress ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{fmtPct(r.avgProgress)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.openDoubts > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <ClipboardCheck className="h-3 w-3" />
                            {r.openDoubts}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorPerformancePage;
