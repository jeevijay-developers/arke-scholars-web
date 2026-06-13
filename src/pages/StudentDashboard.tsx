import { Zap, ClipboardCheck, AlertTriangle, FlaskConical, Compass, BookOpen, Bot, BarChart3, Video, PlayCircle, GraduationCap, Trophy, Star, Clock } from "lucide-react";
import GoalSetupCard from "@/components/GoalSetupCard";
import StudentMentorMeetingCard from "@/components/StudentMentorMeetingCard";

import { useAppStore } from "@/store/useAppStore";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useDashboardData } from "@/hooks/useDashboardData";

const subjectIcons: Record<string, React.ElementType> = {
  Physics: Zap,
  Chemistry: FlaskConical,
  Maths: Compass,
  Mathematics: Compass,
};

const quickActions = [
  { icon: Video, label: "Attend Class", desc: "Join live session", link: "/my-live-classes", bg: "bg-orange-500" },
  { icon: ClipboardCheck, label: "Take Test", desc: "Start a mock test", link: "/my-tests", bg: "bg-emerald-600" },
  { icon: Bot, label: "Ask Doubt", desc: "AI doubt solver", link: "/doubts", bg: "bg-sky-500" },
  { icon: BarChart3, label: "Analytics", desc: "View progress", link: "/analytics", bg: "bg-violet-600" },
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const greetingFor = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const StudentDashboard = () => {
  const { user } = useAppStore();
  const firstName = user?.full_name?.split(" ")[0] || "Student";
  const data = useDashboardData();
  const greeting = greetingFor(new Date());

  return (
    <div className="flex gap-0 pb-24 lg:pb-0">
      <SEO title="My Dashboard" description="Your ARKE Scholars learning dashboard." />
      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-6 min-w-0">
        {/* Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 animate-fade-in-up">
          <div>
            <h1 className="text-xl font-black font-display text-foreground lg:text-2xl">{greeting}, {firstName}</h1>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <GoalSetupCard />
        <StudentMentorMeetingCard />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 stagger-children">
          {quickActions.map(qa => (
            <Link key={qa.label} to={qa.link} className={`rounded-xl ${qa.bg} p-4 text-center hover-lift group`}>
              <qa.icon className="h-6 w-6 text-white mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-white">{qa.label}</p>
              <p className="text-[10px] text-white/70">{qa.desc}</p>
            </Link>
          ))}
        </div>

        {/* Last Accessed Course — Resume */}
        {(() => {
          const last = data.continueWatching[0];
          if (!last) {
            return (
              <div className="rounded-2xl border border-border bg-card p-5 mb-6 animate-fade-in-up">
                <div className="flex flex-col items-center gap-2 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-orange-50 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">No course in progress yet</p>
                      <p className="text-xs text-muted-foreground">Pick a course and start learning.</p>
                    </div>
                  </div>
                  <Link to="/explore-courses" className="rounded-pill bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity">Browse Courses</Link>
                </div>
              </div>
            );
          }
          const isDone = last.progress_pct >= 100;
          const thumb = last.thumbnail_url;
          return (
            <div className="mb-6 animate-fade-in-up">
              <div className="mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pick up where you left off</span>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
                <Link
                  to={`/learn/${last.course_id}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-card hover-lift"
                >
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary to-accent overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt={last.course_name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <GraduationCap className="h-12 w-12 text-white/40" />
                    )}
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary z-10">
                      <Zap className="h-3 w-3" /> Resume
                    </span>
                    {last.is_course_free && (
                      <span className="absolute left-3 bottom-3 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground z-10">
                        FREE
                      </span>
                    )}
                    <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm z-10 ${isDone ? "bg-secondary text-secondary-foreground" : "bg-black/40 text-white"}`}>
                      {isDone && <Trophy className="h-3 w-3" />} {last.progress_pct}%
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {last.target} · Class {last.class}
                    </p>
                    <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {last.course_name}
                    </h3>
                    {last.lesson_title && (
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">Up next: {last.lesson_title}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                      {last.rating != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-secondary text-secondary" /> {last.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {last.progress_pct}% done
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {last.completed_lessons || 0} lessons
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#F97415] transition-all" style={{ width: `${last.progress_pct}%` }} />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Right Panel */}
      <div className="hidden lg:block lg:w-[260px] xl:w-[280px] shrink-0 border-l border-border bg-card p-5 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
        <h3 className="text-sm font-bold font-display text-foreground mb-4">My Performance</h3>

        {/* Rank Cards */}
        <div className="space-y-3 mb-5">
          <div className="rounded-xl bg-orange-500 p-4">
            <p className="text-xs font-medium text-white/80">All India Percentile</p>
            <p className="text-3xl font-black font-display text-white">{data.percentile !== null ? data.percentile : "—"}</p>
            <p className="text-xs font-medium text-white/80">{data.percentile !== null ? "Last 5 tests" : "No tests yet"}</p>
          </div>
          <div className="rounded-xl bg-emerald-600 p-4">
            <p className="text-xs font-medium text-white/80">Overall Accuracy</p>
            <p className="text-3xl font-black font-display text-white">{data.accuracyPct !== null ? `${data.accuracyPct}` : "—"}</p>
            <p className="text-xs font-medium text-white/80">{data.accuracyPct !== null ? "From practice sessions" : "Start practicing"}</p>
          </div>
        </div>

        {/* Subject Performance */}
        <div className="rounded-xl border border-border p-4 mb-5">
          <p className="text-sm font-bold font-display text-foreground mb-3">Subject Performance</p>
          {data.subjectPerformance.length === 0 ? (
            <p className="text-xs text-muted-foreground">Take a test to see breakdown</p>
          ) : (
            data.subjectPerformance.map((s, i) => (
              <div key={s.subject} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{s.subject}</span>
                  <span className="font-bold text-foreground">{s.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className={`h-2 rounded-full transition-all ${i % 3 === 0 ? 'bg-primary' : i % 3 === 1 ? 'bg-secondary' : 'bg-accent'}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Score Trend */}
        {data.scoreTrend.some((p) => p.you > 0) && (
          <div className="rounded-xl border border-border p-4 mb-5">
            <p className="text-sm font-bold font-display text-foreground mb-3">Score Trend</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={data.scoreTrend}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="you" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={{ r: 2 }} name="You" />
                <Line type="monotone" dataKey="avg" stroke="hsl(215, 16%, 47%)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Average" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weak Topics */}
        {data.weakTopics.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-5">
            <p className="text-sm font-bold text-destructive flex items-center gap-1 mb-3">
              <AlertTriangle className="h-4 w-4" /> Weak Areas
            </p>
            {data.weakTopics.map((t) => (
              <div key={t.topic} className="flex justify-between text-xs mb-2">
                <span className="text-foreground">{t.topic}</span>
                <span className={`font-bold ${t.pct < 65 ? 'text-destructive' : 'text-accent'}`}>{t.pct}%</span>
              </div>
            ))}
            <Link to="/my-tests" className="mt-2 block w-full rounded-pill bg-destructive py-2 text-center text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors">
              Practice Now →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
