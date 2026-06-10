import { MessageCircle, Video, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
import { Skeleton } from "@/components/ui/skeleton";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const formatRelativeDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Teacher home — intentionally minimal. Per Phase 3 of the role restructure,
 * teachers only run live classes and resolve doubts. Course / test / student
 * management was moved to the admin portal.
 */
const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { loading, greetingName, stats, upcomingClasses, pendingDoubts } = useTeacherDashboard();

  const openMeeting = (cls: typeof upcomingClasses[number]) => {
    if (!cls.slug) return;
    navigate(`/teacher/live-classes/${cls.slug}`);
  };

  // Two-stat layout reflecting the trimmed role: live classes + doubts.
  const statCards = [
    {
      label: "Upcoming Classes",
      value: upcomingClasses.length.toString(),
      icon: Video,
      change: upcomingClasses[0]
        ? `Next: ${formatRelativeDay(upcomingClasses[0].starts_at)} · ${formatTime(upcomingClasses[0].starts_at)}`
        : "Nothing scheduled",
      color: "text-primary",
      path: "/teacher/live-classes",
    },
    {
      label: "Pending Doubts",
      value: stats.pendingDoubts.toString(),
      icon: MessageCircle,
      change: stats.pendingDoubts > 0 ? "Respond within 24hrs" : "All caught up",
      color: "text-destructive",
      path: "/teacher/doubts",
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div className="animate-fade-in-up">
        <h1 className="text-xl font-bold text-foreground">
          {greeting()}, {loading ? "..." : greetingName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Run your live classes and resolve student doubts assigned to you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
        {statCards.map((s) => (
          <Link key={s.label} to={s.path} className="rounded-xl border border-border bg-card p-4 hover-lift block">
            <div className="flex items-center justify-between">
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            )}
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{s.change}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground">Upcoming Classes</h2>
            <Link to="/teacher/live-classes" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : upcomingClasses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No upcoming classes. Admins schedule classes on your behalf.
              </p>
            ) : (
              upcomingClasses.map((c) => {
                const isLive = c.status === "live";
                return (
                  <Link key={c.id} to="/teacher/live-classes" className="flex items-center gap-3 rounded-lg border border-border p-3 hover-lift">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      {isLive ? <Video className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.batch} · {c.students} registered</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">{formatTime(c.starts_at)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatRelativeDay(c.starts_at)}</p>
                    </div>
                    {c.slug ? (
                      <button
                        onClick={(e) => { e.preventDefault(); openMeeting(c); }}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1 ${isLive ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}
                      >
                        <Video className="h-3 w-3" /> {isLive ? "Join Live" : "Start"}
                      </button>
                    ) : null}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Pending Doubts ({stats.pendingDoubts})</h2>
            <Link to="/teacher/doubts" className="text-xs text-primary font-semibold hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : pendingDoubts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No pending doubts — you're all caught up!</p>
            ) : (
              pendingDoubts.map((d) => (
                <Link key={d.id} to="/teacher/doubts" className="block rounded-lg border border-border p-3 hover-lift">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {d.student.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{d.student}</span>
                    {d.urgent && <AlertCircle className="h-3 w-3 text-destructive" />}
                  </div>
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary mb-1">
                    {d.subject}{d.topic ? ` · ${d.topic}` : ""}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-1">{d.question}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(d.created_at)}</span>
                    <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                      Answer Now <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
