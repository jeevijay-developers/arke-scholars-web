import { Link } from "react-router-dom";
import { ArrowRight, Play, BookOpen, ClipboardCheck, Bot, BarChart3, Swords, Smartphone, Check, Flame, Rocket, GraduationCap, FileText, Trophy, Users, Monitor, Award, Heart, Sparkles, Globe, Video, User, Quote, Clock, ChevronRight, ChevronDown, HelpCircle, Briefcase, IndianRupee, ChevronLeft, Menu, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useState, useRef } from "react";
import EducatorApplicationDialog from "@/components/EducatorApplicationDialog";
import heroIllustration from "@/assets/hero-illustration.png";
import featureLiveClass from "@/assets/feature-live-class.png";
import featureAiDoubt from "@/assets/feature-ai-doubt.png";
import featureAnalytics from "@/assets/feature-analytics.png";
import featureCompete from "@/assets/feature-compete.png";
import featureMobile from "@/assets/feature-mobile.png";
import featureTest from "@/assets/feature-test.png";

const faqs = [
  { q: "What exams does Arke cover?", a: "Arke covers JEE Main, JEE Advanced, NEET, and Board Exams (CBSE & State Boards) for classes 11 and 12. We also offer foundation courses for class 9 and 10." },
  { q: "Can I attend classes from Dubai?", a: "Absolutely! Our live classes run on IST but recordings are available 24/7. Students from UAE, Oman, and other GCC countries study with us regularly." },
  { q: "How does the AI Doubt Solver work?", a: "Simply upload a photo of your question or type it out. Our AI analyzes the problem and gives you a step-by-step solution with explanations within seconds." },
  { q: "Is there a free trial?", a: "Yes! Our Explorer plan is completely free — you get access to 5 live classes, basic test series, and community doubt solving. No credit card required." },
  { q: "What if I miss a live class?", a: "No worries! All live classes are recorded and available in your dashboard within 2 hours. You can rewatch them as many times as you want." },
];

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
      {/* Prev */}
      {activeIndex > 0 && (
        <button
          onClick={() => scrollTo(activeIndex - 1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
      )}
      {/* Next */}
      {activeIndex < count - 1 && (
        <button
          onClick={() => scrollTo(activeIndex + 1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}
      {/* Track */}
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
      {/* Dots */}
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

const navLinks = [
  { label: "Courses", path: "/courses" },
  { label: "Mentorship", path: "/mentorship" },
  { label: "Admission/Scholarship", path: "/admissions" },
  { label: "Association", path: "/association" },
];

const LandingPage = () => {
  const { country, setCountry, user } = useAppStore();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = user?.full_name
    ? user.full_name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('')
    : 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Country Selector Banner */}
      <div className="bg-gradient-to-r from-primary to-accent py-1.5">
        <div className="container mx-auto flex items-center justify-center gap-3 px-4">
          <Globe className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-[11px] font-medium text-primary-foreground/80">Choose your region:</span>
          <div className="flex rounded-full bg-primary-foreground/20 p-0.5">
            <button onClick={() => setCountry('india')} className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-colors ${country === 'india' ? 'bg-primary-foreground text-primary' : 'text-primary-foreground/80 hover:text-primary-foreground'}`}>
              🇮🇳 India
            </button>
            <button onClick={() => setCountry('dubai')} className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-colors ${country === 'dubai' ? 'bg-primary-foreground text-primary' : 'text-primary-foreground/80 hover:text-primary-foreground'}`}>
              🇦🇪 Dubai
            </button>
          </div>
        </div>
      </div>

      {/* Mobile side drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile side drawer */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 bg-card border-r border-border shadow-2xl transition-transform duration-300 ease-in-out md:hidden flex flex-col ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <Link to="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Flame className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-black font-display gradient-text">ARKE</span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Drawer footer auth */}
        <div className="border-t border-border px-4 py-5 space-y-3">
          {user ? (
            <Link
              to="/dashboard"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 bg-muted hover:bg-muted/70 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.full_name?.split(' ')[0] || 'Account'}</p>
                <p className="text-xs text-muted-foreground">Go to Dashboard</p>
              </div>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-pill border border-border py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-pill bg-gradient-to-r from-primary to-accent py-2.5 text-center text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity"
              >
                Start Free
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3">

          {/* Mobile layout: hamburger | centered logo | auth */}
          <div className="flex items-center justify-between md:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <Flame className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-black font-display gradient-text">ARKE</span>
            </Link>

            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-pill border border-border bg-card px-2 py-1 hover:border-primary/50 transition-colors"
                  aria-label="Go to dashboard"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                    ) : initials}
                  </div>
                </Link>
              ) : (
                <Link to="/signup" className="rounded-pill bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity">
                  Start Free
                </Link>
              )}
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <Flame className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-black font-display gradient-text">ARKE</span>
            </Link>
            <div className="flex items-center gap-8">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-pill border border-border bg-card px-2 py-1 pr-4 hover:border-primary/50 transition-colors"
                  aria-label="Go to dashboard"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                    ) : initials}
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">
                    {user.full_name?.split(' ')[0] || 'Account'}
                  </span>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">Login</Link>
                  <Link to="/signup" className="rounded-pill bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity">
                    Start Free
                  </Link>
                </>
              )}
            </div>
          </div>

        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)]">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 70% 30%, hsl(38 92% 50% / 0.2) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 grid-texture" />
        <div className="container mx-auto px-4 py-12 md:py-28 relative z-10">
          <div className="grid items-center gap-8 md:gap-12 md:grid-cols-2">
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary/30 bg-primary/10 px-3 py-1 text-xs md:text-sm font-semibold text-primary">
                <Rocket className="h-3 w-3 md:h-4 md:w-4" /> {country === 'india' ? "India's Rising EdTech Platform" : "UAE's Trusted EdTech Platform"}
              </span>
              <h1 className="mt-4 md:mt-6 font-display">
                <span className="block text-3xl font-black text-white md:text-5xl lg:text-6xl">Start Your Journey,</span>
                <span className="block text-3xl font-black md:text-5xl lg:text-6xl gradient-text">Reach Your Goals</span>
              </h1>
              <p className="mt-3 text-base font-semibold text-white/90">Schooling · Olympiads · Competitive Exams</p>
              <p className="mt-2 max-w-md text-sm md:text-base text-white/70 leading-relaxed">
                Master your exams with live classes from top educators, AI-powered doubt solving, and smart test analytics.
              </p>
              <div className="mt-6 md:mt-8 flex items-center gap-3">
                <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-pill bg-gradient-to-r from-primary to-accent px-5 py-2.5 md:px-8 md:py-3.5 text-sm md:text-base font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-all hover:scale-105">
                  Start for Free <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Link>
                <button className="inline-flex items-center gap-1.5 rounded-pill border border-white/30 px-4 py-2.5 md:px-6 md:py-3.5 text-sm md:text-base font-semibold text-white hover:bg-white/10 transition-colors">
                  <Play className="h-3.5 w-3.5 md:h-4 md:w-4" /> Watch Demo
                </button>
              </div>
              <div className="mt-6 md:mt-10 flex flex-wrap items-center gap-4 text-xs md:text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5 font-semibold"><Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" /> Global Presence</span>
                <span className="inline-flex items-center gap-1.5 font-semibold"><Monitor className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" /> Live Classes</span>
                <span className="inline-flex items-center gap-1.5 font-semibold"><Award className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" /> Unleashing Potential</span>
              </div>
            </div>
            <div className="relative hidden md:block animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, hsl(24 95% 53% / 0.3) 0%, transparent 70%)' }} />
              <img src={heroIllustration} alt="Student studying with laptop and books" width={1024} height={1024} className="mx-auto w-96 drop-shadow-2xl animate-float relative z-10" />
              <Sparkles className="absolute -top-4 right-8 h-6 w-6 text-accent animate-pulse" />
              <Sparkles className="absolute bottom-12 -left-4 h-5 w-5 text-primary animate-pulse" />
              <Sparkles className="absolute top-1/3 -right-2 h-4 w-4 text-secondary animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Strip */}
      <section className="border-b border-border bg-card py-4 md:py-5">
        <div className="container mx-auto px-4">
          <p className="text-center text-[10px] md:text-xs font-semibold text-muted-foreground mb-3 md:mb-4 uppercase tracking-wider">Trusted by students from top institutions</p>
          <div className="flex items-center justify-center gap-5 md:gap-8 flex-wrap opacity-60">
            {["IIT Delhi", "IIT Bombay", "AIIMS", "NIT Trichy", "BITS Pilani", "VIT"].map(name => (
              <span key={name} className="text-xs md:text-sm font-bold text-muted-foreground">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border bg-background py-8 md:py-10">
        <div className="container mx-auto grid grid-cols-2 gap-4 md:gap-6 px-4 md:grid-cols-4 stagger-children">
          {[
            { icon: BookOpen, num: "50,000+", label: "Enrolled Students" },
            { icon: GraduationCap, num: "200+", label: "Expert Teachers" },
            { icon: FileText, num: "10,000+", label: "Test Questions" },
            { icon: Trophy, num: "Top 0.1%", label: "Results" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center gap-1.5 md:gap-2">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                <s.icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <p className="text-xl md:text-2xl font-black font-display text-foreground">{s.num}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">How It Works</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Get started in 3 simple steps</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3 stagger-children relative">
            <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-0.5 border-t-2 border-dashed border-primary/30 z-0" />
            {[
              { step: "1", icon: User, title: "Sign Up Free", desc: "Create your account in under 30 seconds. Choose your exam goal and get a personalized dashboard." },
              { step: "2", icon: BookOpen, title: "Choose Your Course", desc: "Browse courses by subject or goal. Enroll in live batches, 1-on-1 mentoring, or recorded lectures." },
              { step: "3", icon: Rocket, title: "Start Learning", desc: "Attend live classes, take tests, ask doubts via AI, and track your progress with analytics." },
            ].map((s) => (
              <div key={s.step} className="relative z-10 flex h-full flex-col items-center text-center rounded-2xl border border-border bg-background p-8 shadow-sm hover-lift">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg mb-5">
                  <s.icon className="h-7 w-7 text-white" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-primary shadow border-2 border-primary">{s.step}</span>
                </div>
                <h3 className="text-lg font-bold font-display text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {[
                { step: "1", icon: User, title: "Sign Up Free", desc: "Create your account in under 30 seconds. Choose your exam goal and get a personalized dashboard." },
                { step: "2", icon: BookOpen, title: "Choose Your Course", desc: "Browse courses by subject or goal. Enroll in live batches, 1-on-1 mentoring, or recorded lectures." },
                { step: "3", icon: Rocket, title: "Start Learning", desc: "Attend live classes, take tests, ask doubts via AI, and track your progress with analytics." },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center rounded-2xl border border-border bg-background p-6 shadow-sm h-full">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg mb-4">
                    <s.icon className="h-6 w-6 text-white" />
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-primary shadow border-2 border-primary">{s.step}</span>
                  </div>
                  <h3 className="text-base font-bold font-display text-foreground">{s.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Everything in One Place */}
      <section className="py-12 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">
              Everything in One Place
            </h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Everything you need to crack your dream exam</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden sm:grid gap-6 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {[
              { icon: BookOpen, title: "Live Classes", desc: "Real-time classes with top educators. Interactive sessions with live Q&A.", img: featureLiveClass },
              { icon: ClipboardCheck, title: "Smart Test Engine", desc: "JEE/NEET pattern with negative marking, detailed analysis & rank.", img: featureTest },
              { icon: Bot, title: "AI Doubt Solver", desc: "Upload image, get step-by-step solution instantly. Available 24/7.", img: featureAiDoubt },
              { icon: BarChart3, title: "Deep Analytics", desc: "Know your weak topics, chapter heatmaps, and beat the topper.", img: featureAnalytics },
              { icon: Swords, title: "Compete Mode", desc: "1v1 quiz battles, climb the India rank, earn XP and badges.", img: featureCompete },
              { icon: Smartphone, title: "Mobile App", desc: "Study anywhere with offline access. Download lectures on the go.", img: featureMobile },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card overflow-hidden hover-lift group">
                <div className="h-40 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4 overflow-hidden">
                  <img src={f.img} alt={f.title} loading="lazy" width={512} height={512} className="h-32 w-32 object-contain group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <f.icon className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-bold font-display text-foreground">{f.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 sm:hidden px-3">
            <MobileCarousel>
              {[
                { icon: BookOpen, title: "Live Classes", desc: "Real-time classes with top educators. Interactive sessions with live Q&A.", img: featureLiveClass },
                { icon: ClipboardCheck, title: "Smart Test Engine", desc: "JEE/NEET pattern with negative marking, detailed analysis & rank.", img: featureTest },
                { icon: Bot, title: "AI Doubt Solver", desc: "Upload image, get step-by-step solution instantly. Available 24/7.", img: featureAiDoubt },
                { icon: BarChart3, title: "Deep Analytics", desc: "Know your weak topics, chapter heatmaps, and beat the topper.", img: featureAnalytics },
                { icon: Swords, title: "Compete Mode", desc: "1v1 quiz battles, climb the India rank, earn XP and badges.", img: featureCompete },
                { icon: Smartphone, title: "Mobile App", desc: "Study anywhere with offline access. Download lectures on the go.", img: featureMobile },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card overflow-hidden group h-full">
                  <div className="h-32 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-3 overflow-hidden">
                    <img src={f.img} alt={f.title} loading="lazy" width={512} height={512} className="h-24 w-24 object-contain" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <f.icon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-bold font-display text-foreground">{f.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Class Formats */}
      <section className="py-12 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Flexible Class Formats</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Choose how you want to learn</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3 stagger-children">
            {[
              { icon: User, title: "1-on-1 Private Classes", desc: "Personal attention with custom pace and flexible scheduling. Ideal for focused mentoring on weak areas.", features: ["Dedicated mentor", "Custom schedule", "Personalized plan", "Flexible timing"], gradient: "from-primary to-primary-dark" },
              { icon: Users, title: "Live Batch Classes", desc: "Interactive group sessions with real-time doubt solving and peer learning. Join batches of 30-50 students.", features: ["Live interaction", "Real-time doubts", "Peer learning", "Recorded replays"], gradient: "from-secondary to-secondary-dark" },
              { icon: Video, title: "Recorded Lectures", desc: "Learn at your own pace, rewatch anytime. Complete chapter-wise organized course library access.", features: ["Self-paced", "Rewatch anytime", "Chapter-wise", "Offline access"], gradient: "from-accent to-primary" },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-background overflow-hidden hover-lift group">
                <div className={`bg-gradient-to-br ${f.gradient} p-6 text-center`}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mb-3">
                    <f.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-white">{f.title}</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground mb-4">{f.desc}</p>
                  <ul className="space-y-2">
                    {f.features.map(feat => (
                      <li key={feat} className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-secondary shrink-0" /> {feat}
                      </li>
                    ))}
                  </ul>
                  <Link to="/courses" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Learn More <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {[
                { icon: User, title: "1-on-1 Private Classes", desc: "Personal attention with custom pace and flexible scheduling. Ideal for focused mentoring on weak areas.", features: ["Dedicated mentor", "Custom schedule", "Personalized plan", "Flexible timing"], gradient: "from-primary to-primary-dark" },
                { icon: Users, title: "Live Batch Classes", desc: "Interactive group sessions with real-time doubt solving and peer learning. Join batches of 30-50 students.", features: ["Live interaction", "Real-time doubts", "Peer learning", "Recorded replays"], gradient: "from-secondary to-secondary-dark" },
                { icon: Video, title: "Recorded Lectures", desc: "Learn at your own pace, rewatch anytime. Complete chapter-wise organized course library access.", features: ["Self-paced", "Rewatch anytime", "Chapter-wise", "Offline access"], gradient: "from-accent to-primary" },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-background overflow-hidden h-full">
                  <div className={`bg-gradient-to-br ${f.gradient} p-4 text-center`}>
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur mb-2">
                      <f.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold font-display text-white">{f.title}</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-3">{f.desc}</p>
                    <ul className="space-y-1.5">
                      {f.features.map(feat => (
                        <li key={feat} className="flex items-center gap-1.5 text-xs text-foreground">
                          <Check className="h-3 w-3 text-secondary shrink-0" /> {feat}
                        </li>
                      ))}
                    </ul>
                    <Link to="/courses" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Learn More <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Career with Arke */}
      <section className="relative overflow-hidden py-12 md:py-24 bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)]">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 70% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 grid-texture" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center animate-fade-in-up max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary/30 bg-primary/10 px-3 py-1 text-xs md:text-sm font-semibold text-primary">
              <Briefcase className="h-3.5 w-3.5 md:h-4 md:w-4" /> We're Hiring Educators
            </span>
            <h2 className="mt-4 md:mt-5 text-2xl md:text-3xl lg:text-5xl font-black font-display text-white">
              Career with <span className="gradient-text">Arke</span>
            </h2>
            <p className="mt-3 text-sm md:text-base text-white/80 md:text-lg">
              Join India & Dubai's fastest-growing edtech platform. Teach thousands, earn well, work flexibly.
            </p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3 stagger-children max-w-4xl mx-auto">
            {[
              { icon: Clock, title: "Flexible Hours", desc: "Teach from anywhere on a schedule that fits your life. Live, recorded, or 1-on-1." },
              { icon: IndianRupee, title: "Competitive Pay", desc: "Industry-leading compensation with bonus on student outcomes and reviews." },
              { icon: Users, title: "Reach 50,000+ Students", desc: "Inspire learners across India and Dubai. Build your personal brand with us." },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 hover-lift">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent mb-4">
                  <p.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold font-display text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-white/70">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {[
                { icon: Clock, title: "Flexible Hours", desc: "Teach from anywhere on a schedule that fits your life. Live, recorded, or 1-on-1." },
                { icon: IndianRupee, title: "Competitive Pay", desc: "Industry-leading compensation with bonus on student outcomes and reviews." },
                { icon: Users, title: "Reach 50,000+ Students", desc: "Inspire learners across India and Dubai. Build your personal brand with us." },
              ].map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 h-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent mb-3">
                    <p.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-sm font-bold font-display text-white">{p.title}</h3>
                  <p className="mt-1.5 text-xs text-white/70">{p.desc}</p>
                </div>
              ))}
            </MobileCarousel>
          </div>

          <div className="mt-8 md:mt-12 text-center">
            <Link
              to="/career"
              className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-7 py-3 md:px-10 md:py-4 text-sm md:text-lg font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-all hover:scale-105"
            >
              Join Us <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
            <p className="mt-3 text-xs md:text-sm text-white/60">Explore open roles · Response within 48 hours</p>
          </div>
        </div>
      </section>

      {/* Student Success Stories */}
      <section className="py-12 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Student Success Stories</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Real results from real students</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3 stagger-children">
            {[
              { name: "Aditya Rajan", exam: "JEE Advanced 2025", result: "AIR 342", quote: "Arke's live classes and AI doubt solver helped me crack JEE Advanced. Vikram Sir's physics classes were a game changer!", avatar: "AR", tag: "IIT Bombay" },
              { name: "Ishita Bansal", exam: "NEET 2025", result: "AIR 156", quote: "The test series and analytics helped me identify my weak areas. Dr. Kavitha's biology classes were incredibly detailed.", avatar: "IB", tag: "AIIMS Delhi" },
              { name: "Karan Malhotra", exam: "JEE Main 2025", result: "99.8%ile", quote: "I loved the compete mode — battling peers kept me motivated. The 1-on-1 mentoring sessions were the real difference maker.", avatar: "KM", tag: "IIT Delhi" },
            ].map((s) => (
              <div key={s.name} className="rounded-2xl border border-border bg-card p-6 hover-lift relative">
                <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-white">
                    {s.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.exam}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{s.quote}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">{s.result}</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{s.tag}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {[
                { name: "Aditya Rajan", exam: "JEE Advanced 2025", result: "AIR 342", quote: "Arke's live classes and AI doubt solver helped me crack JEE Advanced. Vikram Sir's physics classes were a game changer!", avatar: "AR", tag: "IIT Bombay" },
                { name: "Ishita Bansal", exam: "NEET 2025", result: "AIR 156", quote: "The test series and analytics helped me identify my weak areas. Dr. Kavitha's biology classes were incredibly detailed.", avatar: "IB", tag: "AIIMS Delhi" },
                { name: "Karan Malhotra", exam: "JEE Main 2025", result: "99.8%ile", quote: "I loved the compete mode — battling peers kept me motivated. The 1-on-1 mentoring sessions were the real difference maker.", avatar: "KM", tag: "IIT Delhi" },
              ].map((s) => (
                <div key={s.name} className="rounded-2xl border border-border bg-card p-4 relative h-full">
                  <Quote className="absolute top-3 right-3 h-6 w-6 text-primary/10" />
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {s.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.exam}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">"{s.quote}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-[10px] font-bold text-secondary">{s.result}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">{s.tag}</span>
                  </div>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-12 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Simple Pricing</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Choose a plan that fits your goals</p>
          </div>

          {/* Desktop grid */}
          <div className="mt-10 hidden md:grid gap-6 md:grid-cols-3 stagger-children">
            {[
              { name: "Explorer", price: "Free", desc: "Get started", features: ["5 free live classes", "Basic test series", "Community doubts"], cta: "Start Free", popular: false },
              { name: "JEE Pro", price: country === 'india' ? "₹999" : "AED 149", desc: "/month", features: ["Unlimited live classes", "Full test series", "AI doubt solver", "Analytics"], cta: "Get Pro", popular: true },
              { name: "Elite", price: country === 'india' ? "₹3,999" : "AED 599", desc: "/month", features: ["Everything in Pro", "1-on-1 mentoring", "Personal study plan", "Priority support"], cta: "Go Elite", popular: false },
            ].map((p) => (
              <div key={p.name} className={`relative rounded-2xl border p-8 hover-lift ${p.popular ? 'border-primary bg-background shadow-blue' : 'border-border bg-background shadow-sm'}`}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-gradient-to-r from-primary to-accent px-4 py-1 text-xs font-bold text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold font-display text-foreground">{p.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-black font-display text-foreground">{p.price}</span>
                  <span className="text-muted-foreground">{p.desc}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-secondary" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`mt-8 block rounded-pill py-3 text-center text-sm font-bold transition-colors ${p.popular ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90' : 'border border-border text-foreground hover:bg-primary/5'}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Mobile carousel */}
          <div className="mt-8 md:hidden px-3">
            <MobileCarousel>
              {[
                { name: "Explorer", price: "Free", desc: "Get started", features: ["5 free live classes", "Basic test series", "Community doubts"], cta: "Start Free", popular: false },
                { name: "JEE Pro", price: country === 'india' ? "₹999" : "AED 149", desc: "/month", features: ["Unlimited live classes", "Full test series", "AI doubt solver", "Analytics"], cta: "Get Pro", popular: true },
                { name: "Elite", price: country === 'india' ? "₹3,999" : "AED 599", desc: "/month", features: ["Everything in Pro", "1-on-1 mentoring", "Personal study plan", "Priority support"], cta: "Go Elite", popular: false },
              ].map((p) => (
                <div key={p.name} className={`relative rounded-2xl border p-5 h-full ${p.popular ? 'border-primary bg-background shadow-blue' : 'border-border bg-background shadow-sm'}`}>
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-gradient-to-r from-primary to-accent px-3 py-0.5 text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-base font-bold font-display text-foreground">{p.name}</h3>
                  <div className="mt-3">
                    <span className="text-3xl font-black font-display text-foreground">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.desc}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-secondary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/signup"
                    className={`mt-5 block rounded-pill py-2 text-center text-xs font-bold transition-colors ${p.popular ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90' : 'border border-border text-foreground hover:bg-primary/5'}`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </MobileCarousel>
          </div>
        </div>
      </section>

      {/* Why Arke vs Traditional */}
      <section className="py-12 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Why Arke?</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">See how we compare to traditional coaching</p>
          </div>
          <div className="mt-10 max-w-3xl mx-auto rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-3 bg-gradient-to-r from-primary to-accent text-center">
              <div className="p-3 md:p-4 text-xs md:text-sm font-bold text-white">Feature</div>
              <div className="p-3 md:p-4 text-xs md:text-sm font-bold text-white">Arke</div>
              <div className="p-3 md:p-4 text-xs md:text-sm font-bold text-white">Traditional</div>
            </div>
            {[
              { feature: "Live + Recorded Classes", arke: true, traditional: false },
              { feature: "AI Doubt Solver (24/7)", arke: true, traditional: false },
              { feature: "1-on-1 Mentoring", arke: true, traditional: false },
              { feature: "Flexible Schedule", arke: true, traditional: false },
              { feature: "Smart Analytics", arke: true, traditional: false },
              { feature: "Affordable Pricing", arke: true, traditional: false },
              { feature: "India Rank Compete", arke: true, traditional: false },
              { feature: "Learn from Anywhere", arke: true, traditional: false },
            ].map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-3 text-center border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                <div className="p-2.5 md:p-3 text-[11px] md:text-xs font-medium text-foreground text-left pl-3 md:pl-6">{row.feature}</div>
                <div className="p-2.5 md:p-3 text-sm flex items-center justify-center">
                  {row.arke ? <Check className="h-4 w-4 md:h-5 md:w-5 text-secondary mx-auto" /> : <span className="text-muted-foreground">—</span>}
                </div>
                <div className="p-2.5 md:p-3 text-sm flex items-center justify-center">
                  {row.traditional ? <Check className="h-4 w-4 md:h-5 md:w-5 text-secondary mx-auto" /> : <span className="text-muted-foreground text-xs">✕</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-24 bg-card">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display text-foreground">Frequently Asked Questions</h2>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">Got questions? We've got answers</p>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border bg-background overflow-hidden hover-lift">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-3.5 md:p-4 text-left">
                  <span className="text-xs md:text-sm font-semibold text-foreground flex items-center gap-2">
                    <HelpCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary shrink-0" /> {faq.q}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-3.5 md:px-4 pb-3.5 md:pb-4 pt-0">
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed pl-5 md:pl-6">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Start Your Journey Today */}
      <section className="relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))]" />
        <div className="absolute inset-0 grid-texture" />
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 50%, hsl(24 95% 53% / 0.4) 0%, transparent 60%)' }} />
        <div className="container mx-auto px-4 text-center animate-fade-in-up relative z-10">
          <Sparkles className="mx-auto h-6 w-6 md:h-8 md:w-8 text-accent mb-3 md:mb-4 animate-pulse" />
          <h2 className="text-2xl md:text-3xl lg:text-5xl font-black font-display text-white">Start Your Journey Today</h2>
          <p className="mt-3 md:mt-4 text-sm md:text-lg text-white/90 max-w-sm md:max-w-lg mx-auto">Join 50,000+ students already preparing with Arke. Your dream college is just one step away.</p>
          <Link to="/signup" className="mt-6 md:mt-8 inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-7 py-3 md:px-10 md:py-4 text-sm md:text-lg font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all">
            Start for Free <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </Link>
          <p className="mt-3 md:mt-4 text-xs md:text-sm text-white/60">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(var(--navy))] py-10 md:py-12 text-white">
        <div className="container mx-auto px-4">
          {/* Brand row */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <Flame className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-black font-display gradient-text">ARKE</span>
            </div>
            <p className="text-sm text-white/60 max-w-xs">Empowering students across India & Dubai to achieve their dream exam results.</p>
            <div className="flex gap-3 mt-4">
              {["Twitter", "YouTube", "Instagram"].map(s => (
                <div key={s} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70 hover:bg-white/20 cursor-pointer transition-colors">
                  {s[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Links grid: Quick Links + Company side by side, Reach Us below on mobile */}
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            <div>
              <h4 className="text-sm font-bold mb-3 text-white">Quick Links</h4>
              <div className="space-y-2">
                {["Courses", "Tests", "Live Classes", "Question Bank"].map(l => (
                  <Link key={l} to={`/${l.toLowerCase().replace(/ /g, '-')}`} className="block text-sm text-white/60 hover:text-white/90 transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-3 text-white">Company</h4>
              <div className="space-y-2">
                {[
                  { label: "About Us", path: "/about" },
                  { label: "Careers", path: "/career" },
                  { label: "Join as educator", path: "/career" },
                  { label: "Contact", path: "/contact" },
                  { label: "Privacy Policy", path: "/privacy" },
                  { label: "Terms of Service", path: "/terms" },
                ].map(l => (
                  <Link key={l.label} to={l.path} className="block text-sm text-white/60 hover:text-white/90 transition-colors">{l.label}</Link>
                ))}
              </div>
            </div>
            {/* Reach Us spans full width on mobile (col-span-2), normal column on md+ */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-sm font-bold mb-3 text-white">Reach Us</h4>
              <div className="space-y-2 text-sm text-white/60">
                <p>🇮🇳 New Delhi, India</p>
                <p>🇦🇪 Dubai, UAE</p>
                <p>support@arke.pro</p>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold text-white/80 hover:bg-white/20 cursor-pointer transition-colors">📱 App Store</div>
                <div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold text-white/80 hover:bg-white/20 cursor-pointer transition-colors">▶ Google Play</div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-white/50 flex items-center justify-center gap-1">
              Made with <Heart className="h-3 w-3 text-destructive fill-destructive" /> for Students · © 2026 Arke
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
