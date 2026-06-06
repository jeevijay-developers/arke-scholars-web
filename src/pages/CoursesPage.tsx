import { useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import { Star, Users, Loader2, GraduationCap, Sparkles, ArrowRight, ChevronDown, Trophy, BarChart3 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCourses, type CourseRow } from "@/hooks/useCourses";
import { useAppStore } from "@/store/useAppStore";
import EnrollmentModal from "@/components/EnrollmentModal";
import { SUBJECTS_WITH_ALL } from "@/lib/constants";
import coursePhysics from "@/assets/course-physics.png";
import courseChemistry from "@/assets/course-chemistry.png";
import courseMaths from "@/assets/course-maths.png";
import courseBiology from "@/assets/course-biology.png";

// ── Filter config ─────────────────────────────────────────────────────────────

type ExamOption = {
  label: string;         // shown in pill
  value: string;         // passed to useCourses as targetExam ("All" | "JEE Main" | …)
  children?: string[];   // sub-options shown on hover
  classes: string[];     // class-level pills shown when this exam is active
};

const EXAM_OPTIONS: ExamOption[] = [
  { label: "All",        value: "All",          classes: [] },
  {
    label: "JEE",        value: "JEE",
    children: ["JEE Main", "JEE Advanced"],
    classes: ["Class 11", "Class 12"],
  },
  { label: "NEET",       value: "NEET",         classes: ["Class 11", "Class 12"] },
  { label: "Foundation", value: "Foundation",   classes: ["Class 8", "Class 9", "Class 10"] },
];

const subjectFilters: string[] = [...SUBJECTS_WITH_ALL];

const courseImages: Record<string, string> = {
  Physics: coursePhysics,
  Chemistry: courseChemistry,
  Maths: courseMaths,
  Biology: courseBiology,
};

const highlights = [
  { icon: Trophy,       label: "School + Olympiad + JEE/NEET Prep", desc: "One platform. Complete academic excellence." },
  { icon: GraduationCap, label: "IIT & AIIMS Educators",             desc: "Top mentors shaping future achievers" },
  { icon: BarChart3,    label: "Performance Analytics Dashboard",    desc: "Track growth with precision insights" },
];

// ── Component ─────────────────────────────────────────────────────────────────

const CoursesPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAppStore();
  const navigate = useNavigate();

  // Which top-level exam option is active (index into EXAM_OPTIONS)
  const [activeExamIdx, setActiveExamIdx] = useState(0);
  // When a JEE sub-option is chosen ("JEE Main" | "JEE Advanced" | null)
  const [activeSub, setActiveSub] = useState<string | null>(null);
  // Class level filter ("" = All classes)
  const [activeClass, setActiveClass] = useState("");
  // Subject filter
  const [activeSubject, setActiveSubject] = useState(0);
  // JEE hover dropdown open
  const [jeeOpen, setJeeOpen] = useState(false);
  const jeeRef = useRef<HTMLDivElement>(null);
  const [enrollFor, setEnrollFor] = useState<CourseRow | null>(null);

  // Derived: what value to pass to useCourses
  const activeExam = EXAM_OPTIONS[activeExamIdx];
  const examFilter = activeSub ?? (activeExam.value === "JEE" ? "JEE" : activeExam.value);

  // Close JEE dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jeeRef.current && !jeeRef.current.contains(e.target as Node)) setJeeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Deep-link: ?exam=jee / ?exam=neet / ?exam=foundation
  useEffect(() => {
    const p = searchParams.get("exam")?.toLowerCase();
    if (!p) return;
    if (p.includes("foundation")) { setActiveExamIdx(3); setActiveSub(null); }
    else if (p.includes("neet"))  { setActiveExamIdx(2); setActiveSub(null); }
    else if (p.includes("advanced")) { setActiveExamIdx(1); setActiveSub("JEE Advanced"); }
    else if (p.includes("jee"))   { setActiveExamIdx(1); setActiveSub("JEE Main"); }
    setActiveClass("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { courses, loading } = useCourses(
    examFilter,
    subjectFilters[activeSubject],
    activeClass || undefined,
  );

  const handleEnroll = (c: CourseRow) => {
    if (!user) { navigate("/login"); return; }
    setEnrollFor(c);
  };

  const selectExam = (idx: number) => {
    setActiveExamIdx(idx);
    setActiveSub(null);
    setActiveClass("");
    setJeeOpen(false);
  };

  const selectSub = (sub: string) => {
    setActiveSub(sub);
    setActiveClass("");
    setJeeOpen(false);
  };

  // Label shown in the active JEE pill
  const jeeLabel = activeSub ?? "JEE";
  const classOptions = activeExam.classes;

  return (
    <div className="bg-background">
      <SEO
        title="Online Courses for JEE, NEET & Foundation Exams"
        description="Browse 120+ hour video courses for JEE Main, JEE Advanced, NEET & Foundation. Physics, Chemistry, Maths & Biology by IIT & AIIMS-qualified educators. Start free."
        canonical="/courses"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] py-16 md:py-20">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 70% 30%, hsl(38 92% 50% / 0.2) 0%, transparent 50%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Curated by toppers
          </span>
          <h1 className="mt-5 font-display text-4xl font-black leading-tight text-white md:text-5xl">
            <span className="gradient-text">JEE, NEET & Foundation</span> Exam Courses Online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">
            Browse complete batches for JEE, NEET, Foundation and Olympiads. Live classes, recorded lectures, tests and doubt support — all bundled together.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm text-left">
                <h.icon className="h-5 w-5 text-accent" />
                <p className="mt-2 text-sm font-bold text-white">{h.label}</p>
                <p className="mt-0.5 text-xs text-white/60">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listing */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-in-up">
          <div>
            <h2 className="font-display text-2xl font-black text-foreground md:text-3xl">Popular Batches</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading…" : `${courses.length} course${courses.length === 1 ? "" : "s"} available`}
            </p>
          </div>
          {user && (
            <Link
              to="/my-courses"
              className="inline-flex items-center gap-1 rounded-pill bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              My Learning <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {/* Row 1: Exam filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center">
            {EXAM_OPTIONS.map((opt, i) => {
              const isActive = i === activeExamIdx;
              const isJee = opt.label === "JEE";

              if (isJee) {
                return (
                  <div
                    key="jee"
                    ref={jeeRef}
                    className="relative"
                    onMouseEnter={() => setJeeOpen(true)}
                    onMouseLeave={() => setJeeOpen(false)}
                  >
                    <button
                      onClick={() => { selectExam(i); setJeeOpen((v) => !v); }}
                      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      {isActive ? jeeLabel : "JEE"}
                      <ChevronDown className={`h-3 w-3 transition-transform ${jeeOpen ? "rotate-180" : ""}`} />
                    </button>
                    {jeeOpen && (
                      <div className="absolute left-0 top-full pt-1 z-30 min-w-[144px]">
                        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                          {opt.children!.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => { selectExam(i); selectSub(sub); }}
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-muted/50 ${
                                activeSub === sub && isActive ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={opt.value}
                  onClick={() => selectExam(i)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Row 2: Class level pills — only when an exam is selected */}
          {classOptions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveClass("")}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeClass === ""
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                All Classes
              </button>
              {classOptions.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setActiveClass(cls === activeClass ? "" : cls)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeClass === cls
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Subject filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {subjectFilters.map((s, i) => (
              <button
                key={s}
                onClick={() => setActiveSubject(i)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  i === activeSubject ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">No courses match these filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try a different exam or subject combination.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {courses.map((c) => {
              const img = c.thumbnail_url || courseImages[c.subject] || coursePhysics;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden hover-lift group flex flex-col"
                >
                  <Link to={`/courses/${c.slug}`} className="block">
                    <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-primary to-accent">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <img src={img} alt={c.subject} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-6 opacity-60" />
                      )}
                      {c.badge && (
                        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-foreground">
                          {c.badge}
                        </span>
                      )}
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-bold text-white backdrop-blur-sm">
                          {c.educator_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-[10px] text-white drop-shadow">{c.educator_name}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[10px] font-bold text-primary uppercase">{c.subject}</p>
                    <Link to={`/courses/${c.slug}`} className="block">
                      <p className="text-sm font-bold text-foreground mt-1 line-clamp-2 hover:text-primary transition-colors">{c.name}</p>
                    </Link>
                    {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 text-accent fill-accent" /> {Number(c.rating).toFixed(1)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" /> {(c.total_enrolled ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {c.original_price && c.original_price > c.price && (
                        <span className="text-xs line-through text-muted-foreground">
                          ₹{Number(c.original_price).toLocaleString()}
                        </span>
                      )}
                      <span className="text-sm font-bold text-foreground">₹{Number(c.price).toLocaleString()}</span>
                      {!!c.discount_percent && c.discount_percent > 0 && (
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">
                          {c.discount_percent}% OFF
                        </span>
                      )}
                    </div>
                    <div className="mt-auto pt-3 flex gap-2">
                      <Link
                        to={`/courses/${c.slug}`}
                        className="flex-1 rounded-xl border border-primary py-2 text-xs font-bold text-primary text-center hover:bg-primary/5 transition-colors"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => handleEnroll(c)}
                        className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        Enroll Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {enrollFor && (
        <EnrollmentModal
          open={!!enrollFor}
          onClose={() => setEnrollFor(null)}
          courseId={enrollFor.id}
          courseName={enrollFor.name}
          coursePrice={Number(enrollFor.price)}
          onEnrolled={() => navigate("/my-courses")}
        />
      )}
    </div>
  );
};

export default CoursesPage;
