import {
  Briefcase,
  BookOpen,
  Users,
  Rocket,
  GraduationCap,
  ArrowRight,
  Sparkles,
  MapPin,
  Heart,
  TrendingUp,
  Wallet,
  Globe2,
  Laptop,
  Award,
  Coffee,
  Target,
  LogIn,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EducatorApplicationDialog from "@/components/EducatorApplicationDialog";
import { useAuth } from "@/context/AuthContext";
import arkeLogo from "@/assets/arke-logo.jpeg";

const openings = [
  { subject: "Physics", classes: "CLASS 8 – 10" },
  { subject: "Chemistry", classes: "CLASS 8 – 10" },
  { subject: "Biology", classes: "CLASS 8 – 10" },
  { subject: "Mathematics", classes: "CLASS 8 – 10" },
  { subject: "Science", classes: "CLASS 8 – 10" },
];

const features = [
  {
    icon: BookOpen,
    title: "Smart Live Classes",
    desc: "Interactive, high-engagement live sessions designed for deep understanding — not just lectures.",
  },
  {
    icon: Users,
    title: "Expert Educators",
    desc: "Hand-picked teachers mentoring students with personalized attention.",
  },
  {
    icon: Rocket,
    title: "Built for Outcomes",
    desc: "Adaptive tests, AI doubt solving, and structured learning paths that drive real results.",
  },
];

const teamPillars = [
  {
    icon: GraduationCap,
    title: "Master Educators",
    desc: "Senior mentors from Kota's top coaching institutes who've shaped thousands of toppers.",
    stat: "20+",
    statLabel: "Founding Faculty",
  },
  {
    icon: Laptop,
    title: "Product & Engineering",
    desc: "A small, fast team building delightful learning experiences for India and Dubai.",
    stat: "12+",
    statLabel: "Builders",
  },
  {
    icon: Heart,
    title: "Student Success",
    desc: "Counsellors and mentors obsessed with every learner's journey, every single day.",
    stat: "8+",
    statLabel: "Mentors",
  },
];

const values = [
  {
    icon: Target,
    title: "Outcomes over optics",
    desc: "We measure ourselves on student results — ranks, scores, and confidence — not vanity metrics.",
  },
  {
    icon: Heart,
    title: "Students first, always",
    desc: "Every product, policy, and class plan starts with one question: is this great for the student?",
  },
  {
    icon: Sparkles,
    title: "Craft & quality",
    desc: "From lesson scripts to UI pixels, we obsess over the details that make learning feel joyful.",
  },
];

const benefits = [
  {
    icon: Wallet,
    title: "Top-of-market Pay",
    desc: "Competitive fixed salary plus performance-linked incentives tied to student outcomes.",
  },
  {
    icon: TrendingUp,
    title: "Real Career Growth",
    desc: "Clear progression from educator to lead mentor to academic leadership — backed by mentorship.",
  },
  {
    icon: Globe2,
    title: "India + Dubai Reach",
    desc: "Teach students across India and the GCC. Build a national reputation, not just a local one.",
  },
  {
    icon: Laptop,
    title: "Modern Studio Setup",
    desc: "Production-grade studio, smartboard, and tech support so you can focus on teaching.",
  },
  {
    icon: Award,
    title: "Brand & Visibility",
    desc: "Be featured across our app, website, and campaigns. Build your own teacher brand with us.",
  },
  {
    icon: Coffee,
    title: "Healthy Culture",
    desc: "Reasonable hours, peer learning circles, paid leaves, and a team that genuinely has your back.",
  },
];

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
    const totalWidth = track.scrollWidth - track.clientWidth;
    const idx = Math.round((track.scrollLeft / (totalWidth || 1)) * (count - 1));
    setActiveIndex(Math.max(0, Math.min(count - 1, idx)));
  }

  return (
    <div className={`relative ${className}`}>
      {activeIndex > 0 && (
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
      )}
      {activeIndex < count - 1 && (
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 px-1"
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

const CareerPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleTeacherLogin = () => {
    if (session) {
      navigate("/teacher/dashboard");
    } else {
      navigate("/login?redirect=/teacher/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* SECTION 1 — Hero / Apply */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div aria-hidden className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl -z-10" />
        <div aria-hidden className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-secondary/20 blur-3xl -z-10" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-20 lg:py-24">
          <div className="text-center">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-xs sm:text-sm">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Careers at ARKE
            </Badge>
            <div className="mb-4 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] sm:text-xs font-semibold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Crafted in Kota, Rajasthan · India's Coaching Capital
              </span>
            </div>
            <h1 className="font-heading text-2xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
              Help us redefine how India learns at <span className="text-primary">ARKE</span>
            </h1>
            <p className="mt-4 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Join a founding team of <span className="font-semibold text-foreground">Kota's finest mentors</span> and
              modern product builders. We're hiring exceptional educators to teach{" "}
              <span className="font-semibold text-foreground">Class 6 to 10</span> and shape the next generation of learners.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <EducatorApplicationDialog
                  trigger={
                    <Button
                      size="lg"
                      className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                    >
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  }
                />
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleTeacherLogin}
                  className="w-full sm:w-auto px-5 sm:px-6 text-sm sm:text-base font-semibold text-primary border-primary/40 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all"
                >
                  <LogIn className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Already a teacher? Login
                </Button>
              </div>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Takes ~3 minutes · Reviewed within 48 hours
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — What is ARKE */}
      <section className="py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold">
              What is <span className="text-primary">ARKE</span>?
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Born in <span className="font-semibold text-foreground">Kota — India's coaching capital</span> — ARKE is a next-generation learning platform for India and Dubai,
              powered by master mentors who've shaped thousands of toppers. Built to make world-class education accessible, engaging, and outcome-driven for every learner.
            </p>
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-5 sm:p-6 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="sm:hidden px-3">
            <MobileCarousel>
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card p-5 h-full"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-3">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-heading text-base font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Meet the Team */}
      <section className="py-10 sm:py-20 lg:py-24 bg-card/40 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-14">
            <Badge className="mb-3 bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/20 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Meet the Team
            </Badge>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold">
              A small team. <span className="text-primary">Outsized impact.</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              ARKE is built by a tight-knit group of educators, engineers, designers, and student-success mentors —
              all united by one mission: make great learning accessible to every student.
            </p>
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 mb-12 sm:mb-16">
            {teamPillars.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-background p-6 sm:p-7 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                    <p.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-2xl font-bold text-primary leading-none">{p.stat}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{p.statLabel}</div>
                  </div>
                </div>
                <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="md:hidden px-3 mb-8">
            <MobileCarousel>
              {teamPillars.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-border bg-background p-5 h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                      <p.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-right">
                      <div className="font-heading text-xl font-bold text-primary leading-none">{p.stat}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{p.statLabel}</div>
                    </div>
                  </div>
                  <h3 className="font-heading text-base font-semibold mb-1.5">{p.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </MobileCarousel>
          </div>

          {/* Values strip */}
          <div className="rounded-2xl border border-border bg-background/60 p-5 sm:p-8">
            <h3 className="font-heading text-base sm:text-xl font-semibold mb-5 sm:mb-6 text-center">
              What we stand for
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {values.map((v) => (
                <div key={v.title} className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <v.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm sm:text-base mb-1">{v.title}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Benefits */}
      <section className="py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-14">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-xs sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Why Join ARKE
            </Badge>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold">
              Benefits that respect your <span className="text-primary">craft</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              We invest in our team the way great teachers invest in their students — with care, clarity, and the right tools.
            </p>
          </div>

          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group rounded-2xl border border-border bg-card p-5 sm:p-6 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-heading text-base sm:text-lg font-semibold mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="sm:hidden px-3">
            <MobileCarousel>
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="rounded-2xl border border-border bg-card p-5 h-full"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center mb-3">
                    <b.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-heading text-base font-semibold mb-1.5">{b.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Current Openings */}
      <section className="py-10 sm:py-20 lg:py-24 bg-card/40 border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-14">
            <Badge className="mb-3 bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/20 text-xs sm:text-sm">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Current Openings
            </Badge>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold">
              We're hiring <span className="text-primary">educators</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Pick your subject and apply. We respond to every application within 48 hours.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {openings.map((o) => (
              <div
                key={o.subject}
                className="group relative rounded-2xl border border-border bg-background p-4 sm:p-5 lg:p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">
                    {o.classes}
                  </span>
                </div>
                <div className="font-heading text-base sm:text-xl font-bold leading-snug">
                  {o.subject}
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="mt-10 sm:mt-16 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 sm:p-12 text-center">
            <h3 className="font-heading text-xl sm:text-3xl lg:text-4xl font-bold leading-snug">
              Ready to teach with <span className="text-primary">ARKE</span>?
            </h3>
            <p className="mt-3 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Send us your application — even if your subject isn't listed. Great educators always have a place here.
            </p>
            <div className="mt-5 sm:mt-6 flex flex-col items-center gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <EducatorApplicationDialog
                  trigger={
                    <Button
                      size="lg"
                      className="w-full sm:w-auto px-7 sm:px-10 text-sm sm:text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                    >
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  }
                />
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleTeacherLogin}
                  className="w-full sm:w-auto px-5 sm:px-6 text-sm sm:text-base font-semibold text-primary border-primary/40 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all"
                >
                  <LogIn className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Already a teacher? Login
                </Button>
              </div>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Takes ~3 minutes · Reviewed within 48 hours
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-5 sm:py-8 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={arkeLogo} alt="ARKE" className="h-7 sm:h-9 w-auto object-contain" />
            <span className="text-xs sm:text-sm">© {new Date().getFullYear()} ARKE. All rights reserved.</span>
          </div>
          <a
            href="tel:+918764809537"
            className="inline-flex items-center gap-2 hover:text-primary transition-colors font-medium text-xs sm:text-sm"
          >
            <Phone className="h-4 w-4" />
            +91 8764 809 537
          </a>
        </div>
      </footer>
    </div>
  );
};

export default CareerPage;
