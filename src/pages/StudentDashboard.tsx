import { Zap, ClipboardCheck, AlertTriangle, PhoneCall, FlaskConical, Compass, BadgeCheck, BookOpen, Bot, BarChart3, Video, Calendar, Users, PlayCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import LiveBadge from "@/components/LiveBadge";
import GoalSetupCard from "@/components/GoalSetupCard";
import OnboardingTracker from "@/components/OnboardingTracker";
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
          {/* <div className="flex gap-2">
            <Link to="/contact" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background transition-colors">
              <PhoneCall className="h-3.5 w-3.5" /> Talk to Counsellor
            </Link>
            <Link to="/courses" className="rounded-lg bg-[#F97415] px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity">Enroll in Course</Link>
          </div> */}
        </div>

        <OnboardingTracker />
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
                  <Link to="/courses" className="rounded-pill bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity">Browse Courses</Link>
                </div>
              </div>
            );
          }
          return (
            <Link
              to={last.course_slug ? `/courses/${last.course_slug}/learn` : "/my-courses"}
              className="block rounded-2xl border border-border bg-card p-5 mb-6 animate-fade-in-up hover-lift"
            >
              <div className="mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pick up where you left off</span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black font-display text-foreground truncate">{last.course_name || "Course"}</p>
                  <p className="text-xs text-muted-foreground truncate">{last.lesson_title || last.educator_name || ""}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${last.progress_pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0">{last.progress_pct}%</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-pill bg-primary px-5 py-2 text-center text-xs font-bold text-primary-foreground">Resume</span>
              </div>
            </Link>
          );
        })()}

        {/* Continue Watching */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6 animate-fade-in-up">
          <SectionHeader title="Continue Watching" viewAllLink="/my-courses" />
          {data.continueWatching.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nothing in progress yet — <Link to="/courses" className="text-primary font-bold">browse courses</Link></p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.continueWatching.map(cw => (
                <Link key={cw.lesson_slug + cw.course_id} to={cw.course_slug ? `/courses/${cw.course_slug}/learn` : "/my-courses"} className="flex items-center gap-3 rounded-xl border border-border p-3 hover-lift">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-orange-50 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{cw.course_name || "Course"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{cw.lesson_title || cw.educator_name || ""}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${cw.progress_pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-primary">{cw.progress_pct}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Today's Schedule */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6 animate-fade-in-up">
          <SectionHeader title="Today's Schedule" viewAllLink="/my-live-classes" />
          {data.todaySchedule.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No classes today — <Link to="/my-live-classes" className="text-primary font-bold">view all classes</Link></p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.todaySchedule.map((cls) => {
                const SubjectIcon = subjectIcons[cls.subject] || Zap;
                const isLive = cls.status === "live";
                const isCompleted = cls.status === "completed";
                return (
                  <div key={cls.id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-background/50 transition-colors hover-lift">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center">
                      <SubjectIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isLive ? 'text-destructive' : isCompleted ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatTime(cls.starts_at)}
                        </span>
                        {isLive && <LiveBadge />}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate">{cls.title}</p>
                      <p className="text-xs text-muted-foreground">{cls.educator_name}</p>
                    </div>
                    <div className="shrink-0">
                      {isLive && (
                        <Link to={`/live-classes/${cls.slug}`} className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-bold text-secondary-foreground hover:bg-secondary-dark transition-colors">Join Now</Link>
                      )}
                      {!isLive && !isCompleted && (
                        <span className="text-xs font-medium text-muted-foreground">{cls.user_status === "registered" ? "Registered" : "Upcoming"}</span>
                      )}
                      {isCompleted && (
                        <span className="text-xs font-medium text-muted-foreground">Recording ▶</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
