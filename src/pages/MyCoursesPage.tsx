import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen, Play, Clock, Star, ArrowRight, Sparkles,
  GraduationCap, Trophy, Zap, Loader2,
} from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { toast } from "sonner";

type Course = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  target: string;
  class: string;
  thumbnail_url: string | null;
  rating: number | null;
  badge: string | null;
  is_course_free: boolean;
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

const MyCoursesPage = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id, course_id, progress_percent, completed_lessons,
          last_lesson_title, last_accessed_at,
          course:courses(id, slug, name, description, target, class, thumbnail_url, rating, badge, is_course_free)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("last_accessed_at", { ascending: false, nullsFirst: false });

      if (error) { toast.error("Could not load your courses"); setLoading(false); return; }
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
          <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#F97415] px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
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

  const continueLearning = enrollments.filter((e) => e.progress_percent < 100).slice(0, 4);
  const allEnrolled = enrollments;
  const inProgress = enrollments.filter((e) => e.progress_percent > 0 && e.progress_percent < 100);
  const completed = enrollments.filter((e) => e.progress_percent >= 100);
  const avgProgress = Math.round(enrollments.reduce((s, e) => s + e.progress_percent, 0) / Math.max(enrollments.length, 1));

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

        {/* Stats strip */}
        {enrollments.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-children">
            <StatCard icon={<BookOpen className="h-5 w-5" />} value={enrollments.length} label="Enrolled" color="bg-primary/10 text-primary" />
            <StatCard icon={<Play className="h-5 w-5" />} value={inProgress.length} label="In Progress" color="bg-accent/10 text-accent" />
            <StatCard icon={<Trophy className="h-5 w-5" />} value={completed.length} label="Completed" color="bg-secondary/10 text-secondary" />
            <StatCard icon={<Sparkles className="h-5 w-5" />} value={`${avgProgress}%`} label="Avg Progress" color="bg-primary/10 text-primary" />
          </div>
        )}

        {/* Continue Learning row */}
        {continueLearning.length > 0 && (
          <section className="animate-fade-in-up">
            <SectionHeader title="Continue Learning" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
              {continueLearning.map((e, idx) => (
                <CourseCard key={e.id} enrollment={e} isFirst={idx === 0} />
              ))}
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
              <Link to="/courses" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#F97415] px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
                Explore Courses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
              {allEnrolled.map((e) => <CourseCard key={e.id} enrollment={e} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="font-display text-xl font-black text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CourseCard({ enrollment: e, isFirst }: { enrollment: Enrollment; isFirst?: boolean }) {
  const isDone = e.progress_percent >= 100;
  const thumb = e.course.thumbnail_url;

  return (
    <Link
      to={`/learn/${e.course_id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card hover-lift"
    >
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary to-accent overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={e.course.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <GraduationCap className="h-12 w-12 text-white/40" />
        )}
        {isFirst && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary z-10">
            <Zap className="h-3 w-3" /> Resume
          </span>
        )}
        {e.course.is_course_free && (
          <span className="absolute left-3 bottom-3 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground z-10">
            FREE
          </span>
        )}
        <div className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm z-10 ${isDone ? "bg-secondary text-secondary-foreground" : "bg-black/40 text-white"}`}>
          {isDone && <Trophy className="h-3 w-3" />} {e.progress_percent}%
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{e.course.target} · Class {e.course.class}</p>
        <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">{e.course.name}</h3>
        {e.last_lesson_title && (
          <p className="mt-1 truncate text-[10px] text-muted-foreground">Up next: {e.last_lesson_title}</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          {e.course.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-secondary text-secondary" /> {e.course.rating.toFixed(1)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {e.progress_percent}% done
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {e.completed_lessons} lessons
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#F97415] transition-all" style={{ width: `${e.progress_percent}%` }} />
        </div>
      </div>
    </Link>
  );
}

export default MyCoursesPage;
