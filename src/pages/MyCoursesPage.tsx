import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Play, Clock, Star, ArrowRight, Sparkles, GraduationCap, Trophy, Zap, FlaskConical, Compass, Atom, Loader2 } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { toast } from "sonner";

type Course = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  educator_name: string;
  thumbnail_url: string | null;
  rating: number;
  total_lessons: number;
  duration_hours: number;
  badge: string | null;
};

type Enrollment = {
  id: string;
  course_id: string;
  progress_percent: number;
  completed_lessons: number;
  last_lesson_title: string | null;
  last_accessed_at: string | null;
  course: Course;
};

const subjectIcon: Record<string, React.ElementType> = {
  Physics: Zap,
  Chemistry: FlaskConical,
  Maths: Compass,
  Biology: Atom,
  All: GraduationCap,
};

const subjectGradient: Record<string, string> = {
  Physics: "from-primary to-primary-dark",
  Chemistry: "from-secondary to-secondary-dark",
  Maths: "from-accent to-primary",
  Biology: "from-secondary to-accent",
  All: "from-primary to-accent",
};

const MyCoursesPage = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, course_id, progress_percent, completed_lessons, last_lesson_title, last_accessed_at, course:courses(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("last_accessed_at", { ascending: false, nullsFirst: false });

      if (error) {
        toast.error("Could not load your courses");
        setLoading(false);
        return;
      }
      setEnrollments((data ?? []) as unknown as Enrollment[]);
      setLoading(false);
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="font-display text-xl font-black text-foreground">Sign in to see your courses</h2>
          <p className="mt-2 text-sm text-muted-foreground">Track your progress, pick up where you left off, and unlock your full learning dashboard.</p>
          <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
            Login <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const continueLearning = enrollments.filter((e) => e.progress_percent < 100).slice(0, 3);
  const allEnrolled = enrollments;
  const inProgress = enrollments.filter((e) => e.progress_percent > 0 && e.progress_percent < 100);
  const completed = enrollments.filter((e) => e.progress_percent >= 100);
  const avgProgress = Math.round(enrollments.reduce((s, e) => s + e.progress_percent, 0) / Math.max(enrollments.length, 1));
  const recent = enrollments[0];

  return (
    <div className="pb-20 lg:pb-0">
      <SEO title="My Courses" description="Continue your enrolled courses on ARKE Scholars." />
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="font-display text-2xl font-black text-foreground lg:text-3xl">My Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {enrollments.length === 0
              ? "You haven't enrolled in any courses yet — explore the catalog to get started."
              : `${enrollments.length} enrolled · ${inProgress.length} in progress · ${completed.length} completed`}
          </p>
        </div>

        {/* Resume hero */}
        {recent && recent.progress_percent < 100 && (
          <Link
            to={`/courses/${recent.course.slug}/learn`}
            className="group relative block w-full overflow-hidden rounded-2xl border border-border bg-card hover-lift animate-fade-in-up sm:max-w-sm lg:max-w-[33%]"
          >
            <div className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${subjectGradient[recent.course.subject] ?? "from-primary to-accent"}`}>
              {(() => { const I = subjectIcon[recent.course.subject] ?? BookOpen; return <I className="h-16 w-16 text-white/30" />; })()}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Zap className="h-3 w-3" /> Resume
              </span>
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                <div className="min-w-0 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{recent.course.subject}</p>
                  <h2 className="truncate font-display text-base font-black">{recent.course.name}</h2>
                  {recent.last_lesson_title && (
                    <p className="mt-0.5 truncate text-[11px] text-white/80">Up next: {recent.last_lesson_title}</p>
                  )}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-xl transition-transform group-hover:scale-110">
                  <Play className="h-4 w-4 fill-current" />
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-primary">{recent.progress_percent}% complete</span>
                <span className="text-muted-foreground">{recent.completed_lessons}/{recent.course.total_lessons} lessons</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${recent.progress_percent}%` }} />
              </div>
            </div>
          </Link>
        )}

        {/* Stats strip */}
        {enrollments.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-children">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-xl font-black text-foreground">{enrollments.length}</p>
                <p className="text-[11px] text-muted-foreground">Enrolled</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Play className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-xl font-black text-foreground">{inProgress.length}</p>
                <p className="text-[11px] text-muted-foreground">In Progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Trophy className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-xl font-black text-foreground">{completed.length}</p>
                <p className="text-[11px] text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-xl font-black text-foreground">{avgProgress}%</p>
                <p className="text-[11px] text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </div>
        )}

        {/* Continue Learning row */}
        {continueLearning.length > 1 && (
          <section className="animate-fade-in-up">
            <SectionHeader title="Continue Learning" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {continueLearning.map((e) => {
                const Icon = subjectIcon[e.course.subject] ?? BookOpen;
                const gradient = subjectGradient[e.course.subject] ?? "from-primary to-accent";
                return (
                  <Link
                    key={e.id}
                    to={`/courses/${e.course.slug}/learn`}
                    className="group flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 hover-lift"
                  >
                    <div className={`relative flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-8 w-8 text-white/40" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-lg">
                          <Play className="h-4 w-4 fill-current" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{e.course.subject}</p>
                      <p className="truncate font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">{e.course.name}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-primary">{e.progress_percent}%</span>
                        <span className="text-muted-foreground">{e.completed_lessons}/{e.course.total_lessons}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${e.progress_percent}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* All My Courses */}
        <section className="animate-fade-in-up">
          <SectionHeader title="All My Courses" />
          {allEnrolled.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-display text-lg font-bold text-foreground">No courses yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Browse the catalog to find your perfect batch.</p>
              <Link to="/courses" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
                Explore Courses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
              {allEnrolled.map((e) => {
                const Icon = subjectIcon[e.course.subject] ?? BookOpen;
                const gradient = subjectGradient[e.course.subject] ?? "from-primary to-accent";
                const isDone = e.progress_percent >= 100;
                return (
                  <Link
                    key={e.id}
                    to={`/courses/${e.course.slug}/learn`}
                    className="group overflow-hidden rounded-2xl border border-border bg-card hover-lift"
                  >
                    <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-12 w-12 text-white/40" />
                      {e.course.badge && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-foreground">
                          {e.course.badge}
                        </span>
                      )}
                      <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${isDone ? "bg-secondary text-secondary-foreground" : "bg-black/40 text-white"}`}>
                        {isDone && <Trophy className="h-3 w-3" />} {e.progress_percent}%
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{e.course.subject}</p>
                      <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {e.course.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">{e.course.educator_name}</p>
                      <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-secondary text-secondary" /> {e.course.rating}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {e.course.duration_hours}h
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {e.completed_lessons}/{e.course.total_lessons}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${e.progress_percent}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyCoursesPage;
