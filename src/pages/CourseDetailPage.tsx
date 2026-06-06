import { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import {
  Play,
  CheckCircle2,
  Star,
  Users,
  Clock,
  Heart,
  ChevronDown,
  Loader2,
  Lock,
  FileText,
  Video,
  ClipboardCheck,
  Timer,
  Download,
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCourseDetail } from "@/hooks/useCourseDetail";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavourites } from "@/hooks/useFavourites";
import { CourseReviews } from "@/components/CourseReviews";
import EnrollmentModal from "@/components/EnrollmentModal";

type EnrollmentInfo = {
  id: string;
  progress_percent: number;
  completed_lessons: number;
  last_lesson_title: string | null;
  last_accessed_at: string | null;
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatRelative = (iso: string | null) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

const CourseDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { course, chapters, pdfs, notes, tests, reviewCount, loading } = useCourseDetail(slug);
  const { favouriteIds, toggle: toggleFav } = useFavourites();
  const [activeTab, setActiveTab] = useState(0);
  const [expandedChapter, setExpandedChapter] = useState(0);
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(new Set());

  const enrolled = !!enrollment;

  // Load enrollment + lesson progress
  useEffect(() => {
    if (!user || !course) {
      setEnrollment(null);
      setCompletedSlugs(new Set());
      return;
    }
    (async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("id, progress_percent, completed_lessons, last_lesson_title, last_accessed_at")
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();
      setEnrollment(enr as EnrollmentInfo | null);

      if (enr) {
        const { data: prog } = await supabase
          .from("lesson_progress")
          .select("lesson_slug, is_completed")
          .eq("user_id", user.id)
          .eq("course_id", course.id);
        setCompletedSlugs(new Set((prog ?? []).filter((p) => p.is_completed).map((p) => p.lesson_slug)));
      }
    })();
  }, [user, course]);

  const flatLessons = useMemo(() => chapters.flatMap((c) => c.lessons), [chapters]);
  const totalLessons = flatLessons.length;
  const completedCount = flatLessons.filter((l) => completedSlugs.has(l.slug)).length;
  const totalSeconds = flatLessons.reduce((s, l) => s + (l.duration_seconds || 0), 0);
  const completedSeconds = flatLessons
    .filter((l) => completedSlugs.has(l.slug))
    .reduce((s, l) => s + (l.duration_seconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalHours = course?.duration_hours || Math.max(1, Math.floor(totalMinutes / 60));
  const completedHours = (completedSeconds / 3600).toFixed(1);
  const remainingHours = ((totalSeconds - completedSeconds) / 3600).toFixed(1);
  const progressPercent = enrollment ? (totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0) : 0;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-black text-foreground">Course not found</h1>
        <Link to="/courses" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to courses
        </Link>
      </div>
    );
  }

  const initials = course.educator_name
    ? course.educator_name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "ED";

  const allNotes = [...pdfs, ...notes];
  const tabs = ["About", "Lectures", "Tests", "Notes"];

  const stats = enrolled
    ? [
        { value: String(totalLessons), label: "Lectures" },
        { value: String(tests.length), label: "Tests" },
        { value: String(allNotes.length), label: "Notes" },
        { value: `${totalHours}h`, label: "Total Time" },
        { value: `${progressPercent}%`, label: "Progress" },
      ]
    : [
        { value: String(totalLessons), label: "Lectures" },
        { value: String(tests.length), label: "Tests" },
        { value: String(allNotes.length), label: "Notes" },
        { value: `${totalHours}h`, label: "Total Time" },
        { value: `${course.rating ? Number(course.rating).toFixed(1) : "N/A"}★`, label: "Rating" },
      ];

  const courseAny = course as unknown as { what_youll_learn?: string[] | null; requirements?: string[] | null };
  const whatYoullLearn = (courseAny.what_youll_learn && courseAny.what_youll_learn.length > 0)
    ? courseAny.what_youll_learn
    : [];

  const requirements = (courseAny.requirements && courseAny.requirements.length > 0)
    ? courseAny.requirements
    : [];

  const includes = [
    `${totalLessons} video lecture${totalLessons === 1 ? "" : "s"}`,
    `${tests.length} practice test${tests.length === 1 ? "" : "s"}`,
    `${allNotes.length} note${allNotes.length === 1 ? "" : "s"}`,
    "Lifetime access",
  ];

  const handleEnrollClick = () => {
    if (!user) {
      toast.info("Please sign in to enroll");
      navigate("/login");
      return;
    }
    if (enrolled) {
      navigate(`/courses/${course.slug}/learn`);
      return;
    }
    setEnrollOpen(true);
  };

  const handleEnrolled = async () => {
    if (!user || !course) return;
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, progress_percent, completed_lessons, last_lesson_title, last_accessed_at")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    setEnrollment(enr as EnrollmentInfo | null);
  };

  const discount =
    course.original_price && course.original_price > course.price
      ? Math.round(((Number(course.original_price) - Number(course.price)) / Number(course.original_price)) * 100)
      : course.discount_percent || 0;

  return (
    <div className="bg-background pb-16">
      {course && (
        <SEO
          title={`${course.name} – ${course.subject} for ${(course as { target_exam?: string }).target_exam ?? "JEE, NEET & Boards"}`}
          description={
            course.description
              ? course.description.slice(0, 155)
              : `Master ${course.subject} for ${(course as { target_exam?: string }).target_exam ?? "JEE, NEET & Boards"} with ARKE Scholars. Video lectures, chapter tests & PDF notes by expert educators.`
          }
          canonical={`/courses/${slug}`}
          ogImage={course.thumbnail_url ?? undefined}
          jsonLd={[
            {
              "@context": "https://schema.org",
              "@type": "Course",
              "name": course.name,
              "description": course.description ?? `${course.subject} course for ${(course as { target_exam?: string }).target_exam ?? "JEE, NEET & Boards"}`,
              "url": `https://arke.pro/courses/${slug}`,
              "image": course.thumbnail_url ?? "https://arke.pro/og-default.png",
              "provider": { "@type": "Organization", "name": "ARKE Scholars", "url": "https://arke.pro" },
              "instructor": course.educator_name ? { "@type": "Person", "name": course.educator_name } : undefined,
              "educationalLevel": "HighSchool",
              "about": course.subject,
              "teaches": (course as { target_exam?: string }).target_exam ?? "JEE, NEET & Boards",
              "courseMode": "online",
              "inLanguage": "en",
              "offers": {
                "@type": "Offer",
                "price": String(course.price ?? 0),
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "url": `https://arke.pro/courses/${slug}`
              },
              ...(course.rating && course.total_enrolled && course.total_enrolled > 0
                ? {
                    "aggregateRating": {
                      "@type": "AggregateRating",
                      "ratingValue": String(Number(course.rating).toFixed(1)),
                      "ratingCount": String(course.total_enrolled),
                      "bestRating": "5",
                      "worstRating": "1"
                    }
                  }
                : {})
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://arke.pro" },
                { "@type": "ListItem", "position": 2, "name": "Courses", "item": "https://arke.pro/courses" },
                { "@type": "ListItem", "position": 3, "name": course.name, "item": `https://arke.pro/courses/${slug}` }
              ]
            }
          ]}
        />
      )}
      {/* Hero */}
      <section className="border-b border-border bg-[hsl(var(--muted))]/30">
        <div className="container mx-auto px-4 py-6">
          <div className="text-xs text-muted-foreground mb-4">
            <Link to="/" className="hover:text-primary">Home</Link>
            {" / "}
            <Link to="/courses" className="hover:text-primary">Courses</Link>
            {" / "}
            <span className="text-foreground font-medium">{course.name}</span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-72 shrink-0">
              <div className="aspect-video rounded-2xl border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">course image</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-2">
                {course.subject}
                {course.target_exam ? ` · ${course.target_exam}` : ""}
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-black text-foreground leading-tight">
                {course.name}
              </h1>
              {course.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <strong className="text-foreground">{course.rating ? Number(course.rating).toFixed(1) : "N/A"}</strong>
                  <span>({reviewCount.toLocaleString()} reviews)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  {(course.total_enrolled ?? 0).toLocaleString()} enrolled
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {totalHours} hrs
                </span>
                {course.badge && (
                  <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                    {course.badge}
                  </span>
                )}
                {enrolled && (
                  <span className="flex items-center gap-1.5 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                    <CheckCircle2 className="h-3 w-3" /> Enrolled
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-black text-primary-foreground">
                  {initials}
                </div>
                <p className="text-xs text-muted-foreground">
                  By <span className="font-semibold text-foreground">{course.educator_name}</span>
                  {" · "}
                  <span>{course.subject} Department</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="min-w-0">
          <div className="flex gap-6 border-b border-border overflow-x-auto">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* About */}
          {activeTab === 0 && (
            <div className="mt-6 space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="font-display text-2xl font-black text-foreground">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                    {s.label === "Progress" && (
                      <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                        <div className="h-1 bg-secondary transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">About this course</h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {course.description ||
                    "Full course description text explaining the scope, depth, and approach of this course."}
                </p>
              </div>

              <div>
                <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3">What you'll learn</h3>
                {whatYoullLearn.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No details added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {whatYoullLearn.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-muted-foreground mt-0.5">—</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3">Requirements</h3>
                {requirements.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No requirements listed.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {requirements.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-muted-foreground mt-0.5">—</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <CourseReviews courseId={course.id} enrolled={enrolled} />
            </div>
          )}

          {/* Lectures */}
          {activeTab === 1 && (
            <div className="mt-6 space-y-4">
              {enrolled && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">Your progress</p>
                      <p className="text-xs text-muted-foreground">
                        {completedCount} of {totalLessons} lessons completed
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/courses/${course.slug}/learn`)}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-dark transition-colors shrink-0"
                    >
                      Continue Learning <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-2 bg-secondary transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{progressPercent}% complete</span>
                    {enrollment?.last_lesson_title && (
                      <span className="truncate ml-2">Last watched: {enrollment.last_lesson_title}</span>
                    )}
                  </div>
                </div>
              )}

              {chapters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lectures published yet.</p>
              ) : (
                chapters.map((ch, i) => (
                  <div key={ch.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedChapter(expandedChapter === i ? -1 : i)}
                      className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm font-bold text-foreground text-left">{ch.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{ch.lessons.length} lessons</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedChapter === i ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {expandedChapter === i && (
                      <div className="border-t border-border px-4 py-2 space-y-1">
                        {ch.lessons.map((l) => {
                          const isDone = completedSlugs.has(l.slug);
                          return (
                            <div key={l.id} className="flex items-center gap-2 text-sm py-2 pl-2">
                              {isDone ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                              ) : enrolled || l.is_free_preview ? (
                                <Play className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className={`flex-1 ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {l.title}
                              </span>
                              <span className="text-xs text-muted-foreground">{Math.round(l.duration_seconds / 60)} min</span>
                              {l.is_free_preview && (
                                <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">FREE</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tests */}
          {activeTab === 2 && (
            <div className="mt-6">
              {tests.length === 0 ? (
                <EmptyTab icon={ClipboardCheck} title="Practice Tests" description="Topic-wise and full-length mock tests will appear here once published." />
              ) : (
                <div className="space-y-2">
                  {tests.map((test) => {
                    const canTake = enrolled;
                    return (
                      <div
                        key={test.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{test.title}</p>
                          <p className="text-[11px] text-muted-foreground uppercase mt-0.5">
                            {test.test_type} · {test.duration_minutes} min · {test.total_questions} questions
                          </p>
                        </div>
                        {canTake ? (
                          <Link
                            to={`/tests/${test.slug}/take`}
                            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-dark transition-colors shrink-0"
                          >
                            Take Test <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground shrink-0">
                            <Lock className="h-3.5 w-3.5" /> Enroll to start
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {activeTab === 3 && (
            <div className="mt-6">
              {allNotes.length === 0 ? (
                <EmptyTab icon={FileText} title="Notes" description="Downloadable notes and formula sheets will appear here once your educator uploads them." />
              ) : (
                <div className="space-y-2">
                  {allNotes.map((note) => {
                    const canDownload = enrolled;
                    return (
                      <div
                        key={note.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{note.title}</p>
                          <p className="text-[11px] text-muted-foreground">{note.size_bytes ? formatBytes(note.size_bytes) : "Note"}</p>
                        </div>
                        {canDownload ? (
                          <a
                            href={note.file_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-dark transition-colors shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground shrink-0">
                            <Lock className="h-3.5 w-3.5" /> Enroll to download
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Time */}
          {activeTab === 4 && (
            <div className="mt-6">
              {enrolled ? (
                <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                  <div>
                    <h3 className="font-display text-lg font-black text-foreground">Time Tracker</h3>
                    <p className="text-xs text-muted-foreground">Your progress through this course</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <TimeStat label="Total" value={`${totalHours}h`} />
                    <TimeStat label="Completed" value={`${completedHours}h`} accent="text-secondary" />
                    <TimeStat label="Remaining" value={`${remainingHours}h`} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-foreground">{progressPercent}% complete</span>
                      <span className="text-muted-foreground">{completedCount}/{totalLessons} lessons</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-2 bg-secondary transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  {enrollment?.last_accessed_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5" /> Last accessed {formatRelative(enrollment.last_accessed_at)}
                    </p>
                  )}

                  <button
                    onClick={() => navigate(`/courses/${course.slug}/learn`)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark transition-colors"
                  >
                    Continue Learning <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <EmptyTab icon={Timer} title="Track your time" description="Enroll in this course to start tracking your study time and progress." />
              )}
            </div>
          )}
        </div>

        {/* Sticky purchase / progress card */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt="preview" className="h-full w-full object-cover" />
              ) : (
                "course preview"
              )}
            </div>

            {enrolled ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-secondary/10 px-3 py-2 text-secondary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-bold">You're enrolled</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-foreground">{progressPercent}% complete</span>
                    <span className="text-muted-foreground">{completedCount}/{totalLessons}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-2 bg-secondary transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/courses/${course.slug}/learn`)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-foreground py-3 text-sm font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Continue Learning <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  disabled
                  className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground bg-muted/30 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> Enrolled
                </button>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-display text-3xl font-black text-foreground">
                    ₹{Number(course.price).toLocaleString()}
                  </span>
                  {course.original_price && course.original_price > course.price && (
                    <span className="text-sm text-muted-foreground line-through">
                      ₹{Number(course.original_price).toLocaleString()}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="ml-auto rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-bold text-secondary">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                <button
                  onClick={handleEnrollClick}
                  className="w-full rounded-xl bg-foreground py-3 text-sm font-bold text-background hover:opacity-90 transition-opacity"
                >
                  Enroll Now →
                </button>

                <button
                  onClick={() => toggleFav(course.id)}
                  className={`w-full rounded-xl border py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    favouriteIds.has(course.id)
                      ? "border-rose-500 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                      : "border-border text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favouriteIds.has(course.id) ? "fill-rose-500" : ""}`} />
                  {favouriteIds.has(course.id) ? "Saved to Favourites" : "Add to Favourite"}
                </button>
              </>
            )}

            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">This course includes</p>
              {includes.map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                  {item}
                </div>
              ))}
            </div>

            {/* Guarantee removed */}
          </div>
        </aside>
      </div>

      <EnrollmentModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        courseId={course.id}
        courseName={course.name}
        coursePrice={Number(course.price)}
        onEnrolled={handleEnrolled}
      />
    </div>
  );
};

const TimeStat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
    <p className={`font-display text-xl font-black ${accent ?? "text-foreground"}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);

const EmptyTab = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Video;
  title: string;
  description: string;
}) => (
  <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
    <Icon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
    <h4 className="font-display text-base font-bold text-foreground">{title}</h4>
    <p className="text-xs text-muted-foreground mt-1">{description}</p>
  </div>
);

export default CourseDetailPage;
