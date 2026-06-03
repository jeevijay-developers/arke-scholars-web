import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import {
  ArrowRight, Play, Check, CheckCircle2, Trophy, FileText, MessageCircle,
  GraduationCap, ChevronRight, ChevronLeft,
} from "lucide-react";
import { useState, useRef } from "react";
import { useCourseBanners, type CourseBanner } from "@/hooks/useCourseBanners";
import MarqueeTestimonials from "@/components/MarqueeTestimonialCard";

/** Lightweight horizontal carousel for mobile — hides scrollbar, shows dots */
function MobileCarousel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const childArray = Array.isArray(children) ? children : [children];
  const count = childArray.length;

  function scrollTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement;
    if (card) {
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
      setActiveIndex(index);
    }
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    const totalWidth = track.scrollWidth - track.clientWidth;
    const idx = Math.round((scrollLeft / (totalWidth || 1)) * (count - 1));
    setActiveIndex(Math.max(0, Math.min(count - 1, idx)));
  }

  return (
    <div className={`relative ${className}`}>
      {activeIndex > 0 && (
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
      )}
      {activeIndex < count - 1 && (
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {childArray.map((child, i) => (
          <div key={i} className="snap-start shrink-0 w-[78vw] max-w-[280px]">
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {childArray.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`rounded-full transition-all ${i === activeIndex ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-border"}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATS = [
  { icon: Trophy, value: "500+", label: "Top 100 AIR" },
  { icon: GraduationCap, value: "Highly", label: "Qualified Mentors" },
  { icon: FileText, value: "10,000+", label: "Tests & Notes" },
  { icon: MessageCircle, value: "24×7", label: "Doubt Solving" },
];

const EXAM_CARDS = [
  {
    title: "IIT-JEE",
    image: "/exam-svgs/iit-jee.svg",
    points: ["Advanced Problem Solving", "Mock Test Series"],
    exam: "JEE Main",
  },
  {
    title: "NEET",
    image: "/exam-svgs/neet.svg",
    points: ["Biology Specialization", "Daily Practice Papers"],
    exam: "NEET",
  },
  {
    title: "Foundation",
    image: "/exam-svgs/foundation.svg",
    points: ["Conceptual Clarity", "Olympiad Prep"],
    exam: "Foundation",
  },
];

const APP_BULLETS = [
  "Live & recorded classes available at ease",
  "Dashboard for progress tracking",
  "Lakhs of practice questions",
];

const LandingPage = () => {
  const { banners } = useCourseBanners();
  const banner = banners[0];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="JEE, NEET & Foundation Exam Prep Online"
        description="Crack JEE Main, JEE Advanced, NEET & Foundation with ARKE Scholars. Live classes from IIT educators, AI doubt solving, 500+ mock tests & 1-on-1 mentorship."
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "ARKE Scholars",
            "alternateName": ["Arke", "Arke Scholars", "Arke Pro", "Arke EdTech", "arke.pro"],
            "url": "https://arke.pro",
            "logo": "https://arke.pro/logo.png",
            "description": "ARKE Scholars (arke.pro) is India's next-gen EdTech platform for JEE Main, JEE Advanced, NEET, and Foundation exam preparation.",
            "foundingDate": "2024",
            "areaServed": ["IN"],
            "sameAs": [
              "https://www.instagram.com/arkescholars",
              "https://www.youtube.com/@arkescholars",
              "https://www.linkedin.com/company/arkescholars"
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "ARKE Scholars",
            "url": "https://arke.pro",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://arke.pro/courses?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": "ARKE Scholars",
            "url": "https://arke.pro",
            "description": "Online coaching for JEE Main, JEE Advanced, NEET and Foundation exams",
            "areaServed": [
              { "@type": "Country", "name": "India" }
            ]
          }
        ]}
      />

      {/* Active courses banner — only shown if an admin has added one. Full-bleed, no margin. */}
      {banner && (
        banner.cta_link ? (
          <Link to={banner.cta_link} className="block w-full">
            <BannerContent banner={banner} />
          </Link>
        ) : (
          <BannerContent banner={banner} />
        )
      )}

      {/* Hero */}
      <section className="bg-[hsl(var(--navy))] overflow-hidden">
        <div className="max-w-[70rem] mx-auto px-4 pt-10 pb-12 md:pt-10 md:pb-0">
          <div className="grid items-end gap-8 md:gap-4 md:grid-cols-2">
            <div className="text-center md:text-left md:pb-40 order-2 md:order-1">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-primary/10 px-3 py-1 text-xs md:text-sm font-semibold text-primary">
                India's Rising EdTech Platform
              </span>
              <h1 className="mt-4 md:mt-6 font-display">
                <span className="block text-[1.75rem] leading-tight sm:text-3xl font-black text-white md:text-5xl lg:text-6xl">JEE, NEET &amp; Foundation</span>
                <span className="block text-[1.75rem] leading-tight sm:text-3xl font-black text-primary md:text-5xl lg:text-6xl">Exam Prep That Works</span>
              </h1>
              <p className="mt-3 md:mt-4 mx-auto md:mx-0 max-w-md text-sm md:text-base text-white/70 leading-relaxed">
                <strong className="text-white/90">ARKE Scholars</strong> helps you master JEE, NEET &amp; Foundation exams with live classes from top educators, AI-powered doubt solving, and smart test analytics.
              </p>
              <div className="mt-6 md:mt-8 flex items-center justify-center md:justify-start gap-3">
                <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-6 py-3 md:px-8 md:py-3.5 text-sm md:text-base font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Image — hidden on mobile, bottom-aligned beside the text on desktop */}
            <div className="relative hidden md:flex justify-start items-end self-stretch order-1 md:order-2">
              <img
                src="/hero-section-img.png"
                alt="Mentor guiding students for JEE, NEET and Foundation exams"
                width={720}
                height={620}
                loading="eager"
                className="w-auto h-56 sm:h-72 md:h-[38rem] object-contain object-bottom"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-card py-10 md:pb-12 md:pt-0">
        {/* Mobile: standalone carousel, not attached to the hero */}
        <div className="md:hidden px-4">
          <MobileCarousel>
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-8">
                <s.icon className="h-7 w-7 text-primary" />
                <p className="text-2xl font-black font-display text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </MobileCarousel>
        </div>

        {/* Desktop: single card overlapping the bottom of the hero */}
        <div className="hidden md:block max-w-[70rem] mx-auto px-4 relative bottom-12 -mb-12">
          <div className="rounded-2xl border border-border bg-card shadow-[0_10px_40px_-12px_rgba(0,0,0,0.2)]">
            <div className="grid grid-cols-4">
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex flex-col items-center text-center gap-1.5 px-4 py-8 ${i === 0 ? "" : "border-l border-border"}`}
                >
                  <s.icon className="h-7 w-7 text-primary" />
                  <p className="text-2xl font-black font-display text-foreground">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Exam cards */}
      <section className="bg-card py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Choose Your Exam</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Focused preparation tracks for every goal</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3">
            {EXAM_CARDS.map((e) => (
              <ExamCard key={e.title} exam={e} />
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {EXAM_CARDS.map((e) => (
                <ExamCard key={e.title} exam={e} />
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Mobile app download CTA */}
      <section className="bg-primary/5 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-8 md:gap-6 md:grid-cols-2">
            <div className="text-center md:text-left md:ml-auto md:max-w-md">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">
                Join thousands of students on the app today!
              </h2>
              <ul className="mt-6 space-y-3 inline-block text-left">
                {APP_BULLETS.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm md:text-base text-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap justify-center md:justify-start gap-3">
                <StoreButton store="Google Play" caption="GET IT ON" />
                <StoreButton store="App Store" caption="Download on the" />
              </div>
            </div>
            <div className="flex justify-center md:justify-start">
              <img
                src="/mobile-app.png"
                alt="ARKE Scholars mobile app preview"
                width={300}
                height={500}
                loading="lazy"
                className="w-48 md:w-[14rem]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Student testimonials */}
      <section className="bg-background py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Student Success Stories</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Real results from real students</p>
          </div>
          <div className="mt-6">
            <MarqueeTestimonials />
          </div>
        </div>
      </section>
    </div>
  );
};

/** Full-bleed promotional banner. Edge-to-edge, no x/y margin. */
function BannerContent({ banner }: { banner: CourseBanner }) {
  // If an image is provided, show it full-width with no margins. Text/CTA overlay on top when present.
  if (banner.image_url) {
    return (
      <div className="relative w-full">
        <img src={banner.image_url} alt={banner.title} className="block w-full h-[8rem] sm:h-[11rem] md:h-[16rem] object-cover" loading="eager" />
        {(banner.title || banner.subtitle || banner.cta_label) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 px-4 text-center text-white">
            {banner.title && <p className="text-base md:text-2xl font-black font-display">{banner.title}</p>}
            {banner.subtitle && <p className="text-xs md:text-base text-white/90">{banner.subtitle}</p>}
            {banner.cta_label && (
              <span className="mt-1 rounded-pill bg-primary px-4 py-1.5 text-xs md:text-sm font-bold text-primary-foreground">
                {banner.cta_label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  // No image — solid accent strip, full width.
  return (
    <div className="w-full bg-primary text-primary-foreground">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-4 py-3 text-center">
        <p className="text-sm md:text-base font-bold">{banner.title}</p>
        {banner.subtitle && <p className="text-xs md:text-sm text-primary-foreground/80">{banner.subtitle}</p>}
        {banner.cta_label && (
          <span className="rounded-pill bg-primary-foreground px-4 py-1.5 text-xs md:text-sm font-bold text-primary">
            {banner.cta_label}
          </span>
        )}
      </div>
    </div>
  );
}

function ExamCard({ exam }: { exam: typeof EXAM_CARDS[number] }) {
  return (
    <Link
      to={`/courses?exam=${encodeURIComponent(exam.exam)}`}
      className="group relative flex h-[26rem] flex-col overflow-hidden rounded-2xl border border-border ring-0 transition-[box-shadow,transform] duration-200"
    >
      {/* Full-bleed background image */}
      <img
        src={exam.image}
        alt={`${exam.title} courses`}
        width={400}
        height={520}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
      />
      {/* Dark scrim only over the bottom 30%, for text legibility */}
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[linear-gradient(to_top,rgba(10,15,28,0.95)_0%,rgba(10,15,28,0.7)_45%,transparent_100%)]" />

      {/* Spacer pushes the content block to the bottom */}
      <div className="relative z-10 flex-1" />

      {/* Footer — title + checklist + CTA */}
      <div className="relative z-10 px-6 pb-6">
        <h3 className="mb-3 text-3xl md:text-4xl font-black font-display text-[#e27100] tracking-tight">
          {exam.title}
        </h3>
        <ul className="space-y-2">
          {exam.points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-white/90">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {p}
            </li>
          ))}
        </ul>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-primary">
          Explore Courses <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

/** Placeholder app-store badge button. Fires a "coming soon" toast until real URLs exist. */
function StoreButton({ store, caption }: { store: string; caption: string }) {
  return (
    <button
      onClick={() => toast.info(`${store} app coming soon!`)}
      className="flex items-center gap-3 rounded-xl bg-[hsl(var(--navy))] px-5 py-2.5 text-left text-white hover:bg-[hsl(var(--navy2))] transition-colors"
    >
      <div>
        <span className="block text-[10px] uppercase tracking-wide text-white/70">{caption}</span>
        <span className="block text-base font-bold leading-tight">{store}</span>
      </div>
    </button>
  );
}

export default LandingPage;
