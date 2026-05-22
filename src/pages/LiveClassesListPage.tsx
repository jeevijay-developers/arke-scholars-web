import { Video, Calendar, Play, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { useLiveClasses } from "@/hooks/useLiveClasses";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";
import { useAuth } from "@/context/AuthContext";
import LiveBadge from "@/components/LiveBadge";

const subjectColors: Record<string, string> = {
  Physics: "from-blue-500 to-blue-600",
  Chemistry: "from-green-500 to-green-600",
  Mathematics: "from-purple-500 to-purple-600",
  Biology: "from-pink-500 to-pink-600",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (Math.abs(diffH) < 24 && d.getDate() === now.getDate()) return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffH > 0 && diffH < 48) return `Tomorrow, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const LiveClassesListPage = () => {
  const { classes: liveAndUpcoming, loading } = useLiveClasses("all");
  const { enrolledCourseIds, loading: enrollmentLoading } = useEnrolledCourseIds();
  const { isStaff, isTeacher } = useAuth();

  if (loading || enrollmentLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const canSeeAll = isStaff || isTeacher;
  const visible = canSeeAll
    ? liveAndUpcoming
    : liveAndUpcoming.filter((c) => c.course_id === null || enrolledCourseIds.has(c.course_id));

  const now = new Date();
  const live = visible.filter((c) => c.status === "live");
  const upcoming = visible.filter(
    (c) => c.status === "scheduled" && new Date(c.starts_at) >= now,
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <SEO title="My Live Classes" description="View upcoming and past live classes on ARKE Scholars." />
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Video className="h-7 w-7" />
          <h1 className="text-2xl font-black font-display">Live Classes</h1>
        </div>
        <p className="text-white/90 text-sm">Join interactive sessions with top educators in real-time</p>
        <div className="flex gap-4 mt-4 flex-wrap">
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{live.length}</p>
            <p className="text-[10px] text-white/80">Live now</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{upcoming.length}</p>
            <p className="text-[10px] text-white/80">Upcoming</p>
          </div>
        </div>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Live now</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {live.map((c) => (
              <Link key={c.id} to={`/live-classes/${c.slug}`} className="rounded-2xl border border-border bg-card overflow-hidden hover-lift">
                <div className={`h-28 bg-gradient-to-br ${subjectColors[c.subject] ?? "from-primary to-accent"} relative flex items-center justify-center`}>
                  <Video className="h-12 w-12 text-white/40" />
                  <div className="absolute top-3 left-3"><LiveBadge /></div>
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-bold text-primary uppercase">{c.subject}</p>
                  <h3 className="text-sm font-bold text-foreground mt-1 line-clamp-2">{c.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{c.educator_name}</p>
                  <button className="mt-3 w-full rounded-lg bg-destructive py-2 text-xs font-bold text-destructive-foreground flex items-center justify-center gap-1">
                    <Play className="h-3 w-3" /> Join Now
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming classes scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => (
              <Link key={c.id} to={`/live-classes/${c.slug}`} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover-lift">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${subjectColors[c.subject] ?? "from-primary to-accent"} text-white shrink-0`}>
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.educator_name} · {c.subject}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(c.starts_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default LiveClassesListPage;
