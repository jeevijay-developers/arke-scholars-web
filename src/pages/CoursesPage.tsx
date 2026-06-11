import { useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import { Star, Loader2, GraduationCap, ArrowRight, ChevronDown } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCourses, type CourseRow } from "@/hooks/useCourses";
import { useCourseBanners, type CourseBanner } from "@/hooks/useCourseBanners";
import { useAppStore } from "@/store/useAppStore";
import EnrollmentModal from "@/components/EnrollmentModal";

// ── Filter config ─────────────────────────────────────────────────────────────

type ClassOption = { label: string; value: string };

type ExamOption = {
  label: string;
  value: string;
  children?: string[];
  classes: ClassOption[];
};

const EXAM_OPTIONS: ExamOption[] = [
  { label: "All", value: "All", classes: [] },
  {
    label: "JEE", value: "JEE",
    children: ["MAINS", "Advance"],
    classes: [
      { label: "Class 11", value: "11" },
      { label: "Class 12", value: "12" },
      { label: "12th Pass", value: "12th_pass" },
    ],
  },
  {
    label: "NEET", value: "NEET",
    classes: [
      { label: "Class 11", value: "11" },
      { label: "Class 12", value: "12" },
      { label: "12th Pass", value: "12th_pass" },
    ],
  },
  {
    label: "Foundation", value: "Foundation",
    classes: [
      { label: "Class 8", value: "8" },
      { label: "Class 9", value: "9" },
      { label: "Class 10", value: "10" },
    ],
  },
];

// ── Price display helper ───────────────────────────────────────────────────────

function CoursePrice({ course }: { course: CourseRow }) {
  if (course.is_course_free) {
    return <span className="text-sm font-bold text-secondary">Free</span>;
  }
  const displayPrice = course.show_price_with_gst
    ? Math.round(course.sale_price * 1.18)
    : course.sale_price;
  const displayMrp = course.show_price_with_gst
    ? Math.round(course.mrp * 1.18)
    : course.mrp;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {displayMrp > displayPrice && (
        <span className="text-xs line-through text-muted-foreground">
          ₹{displayMrp.toLocaleString()}
        </span>
      )}
      <span className="text-sm font-bold text-foreground">
        ₹{displayPrice.toLocaleString()}
        {course.show_price_with_gst && (
          <span className="text-[10px] font-normal text-muted-foreground"> incl. GST</span>
        )}
      </span>
      {!!course.discount_percent && Number(course.discount_percent) > 0 && (
        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">
          {Number(course.discount_percent).toFixed(0)}% OFF
        </span>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const CoursesPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAppStore();
  const navigate = useNavigate();

  const [activeExamIdx, setActiveExamIdx] = useState(0);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState("");
  const [jeeOpen, setJeeOpen] = useState(false);
  const jeeRef = useRef<HTMLDivElement>(null);
  const [enrollFor, setEnrollFor] = useState<CourseRow | null>(null);
  const { banners } = useCourseBanners();

  const activeExam = EXAM_OPTIONS[activeExamIdx];
  const targetFilter = activeExam.value;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jeeRef.current && !jeeRef.current.contains(e.target as Node)) setJeeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const p = searchParams.get("exam")?.toLowerCase();
    if (!p) return;
    if (p.includes("foundation")) { setActiveExamIdx(3); setActiveSub(null); }
    else if (p.includes("neet")) { setActiveExamIdx(2); setActiveSub(null); }
    else if (p.includes("jee")) { setActiveExamIdx(1); setActiveSub(null); }
    setActiveClass("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { courses, loading } = useCourses(
    targetFilter === "All" ? undefined : targetFilter,
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

  const jeeLabel = activeSub ? `JEE ${activeSub}` : "JEE";
  const classOptions = activeExam.classes;

  return (
    <div className="bg-background">
      <SEO
        title="Online Courses for JEE, NEET & Foundation Exams"
        description="Browse 120+ hour video courses for JEE Main, JEE Advanced, NEET & Foundation. Physics, Chemistry, Maths & Biology by IIT & AIIMS-qualified educators. Start free."
        canonical="/courses"
      />

      <BannerCarousel banners={banners} />

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
              className="inline-flex items-center gap-1 rounded-pill bg-[#F97415] px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              My Learning <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {/* Exam filter row */}
          <div className="flex gap-2 flex-wrap items-center">
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
                      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1 ${isActive
                          ? "bg-[#F97415] text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-muted/30"
                        }`}
                    >
                      {isActive ? jeeLabel : "JEE"}
                      <ChevronDown className={`h-3 w-3 transition-transform ${jeeOpen ? "rotate-180" : ""}`} />
                    </button>
                    {jeeOpen && (
                      <div className="absolute left-0 top-full pt-1 z-50 min-w-[144px]">
                        <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                          {opt.children!.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => { selectExam(i); setActiveSub(sub); setJeeOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-muted/50 ${activeSub === sub && isActive ? "text-primary" : "text-foreground"
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
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${isActive
                      ? "bg-[#F97415] text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Class filter row */}
          {classOptions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveClass("")}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeClass === ""
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/50"
                  }`}
              >
                All Classes
              </button>
              {classOptions.map((cls) => (
                <button
                  key={cls.value}
                  onClick={() => setActiveClass(cls.value === activeClass ? "" : cls.value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeClass === cls.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/50"
                    }`}
                >
                  {cls.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">No courses match these filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try a different exam or class combination.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {courses.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-card overflow-hidden hover-lift group flex flex-col"
              >
                <Link to={`/courses/${c.slug}`} className="block">
                  <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-primary to-accent">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <GraduationCap className="h-12 w-12 text-white/30" />
                      </div>
                    )}
                    {c.badge && (
                      <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-foreground">
                        {c.badge}
                      </span>
                    )}
                    <span className="absolute top-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {c.target} · Class {c.class}
                    </span>
                  </div>
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-[10px] font-bold text-primary uppercase">{c.target}</p>
                  <Link to={`/courses/${c.slug}`} className="block">
                    <p className="text-sm font-bold text-foreground mt-1 line-clamp-2 hover:text-primary transition-colors">{c.name}</p>
                  </Link>
                  {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                  {c.rating != null && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-accent fill-accent" /> {Number(c.rating).toFixed(1)}
                    </div>
                  )}
                  <div className="mt-3">
                    <CoursePrice course={c} />
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
                      className="flex-1 rounded-xl bg-[#F97415] py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      {c.is_course_free ? "Enroll Free" : "Enroll Now"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {enrollFor && (
        <EnrollmentModal
          open={!!enrollFor}
          onClose={() => setEnrollFor(null)}
          courseId={enrollFor.id}
          courseName={enrollFor.name}
          coursePrice={enrollFor.is_course_free ? 0 : Number(enrollFor.sale_price)}
          onEnrolled={() => navigate("/my-courses")}
        />
      )}
    </div>
  );
};

// ── Banner components ─────────────────────────────────────────────────────────

function BannerImage({ banner }: { banner: CourseBanner }) {
  const img = (
    <img
      src={banner.image_url!}
      alt={banner.title || "Promotional banner"}
      className="block w-full h-[8rem] sm:h-[11rem] md:h-[16rem] object-cover"
      loading="eager"
    />
  );
  return banner.cta_link ? (
    <Link to={banner.cta_link} className="block w-full">{img}</Link>
  ) : img;
}

function BannerCarousel({ banners }: { banners: CourseBanner[] }) {
  const slides = banners.filter((b) => b.image_url);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const idx = (i + slides.length) % slides.length;
    track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
    setActive(idx);
  };

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % slides.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
      setActive(next);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;
  if (slides.length === 1) return <BannerImage banner={slides[0]} />;

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <div className="relative w-full">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((b) => (
          <div key={b.id} className="w-full shrink-0 snap-start">
            <BannerImage banner={b} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${i === active ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/60"}`}
            aria-label={`Go to banner ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default CoursesPage;
