import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  Timer,
  BarChart3,
  Trophy,
  Brain,
  Target,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
  BookMarked,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const features = [
  {
    icon: Timer,
    title: "Real Exam Simulation",
    description: "Take tests in a distraction-free, full-screen environment that mirrors the JEE, NEET and Board exam interface — including timers, palette and section switching.",
  },
  {
    icon: Brain,
    title: "Adaptive Difficulty",
    description: "Our engine learns from your accuracy and adjusts question difficulty so you're always challenged at the right level — not too easy, not too hard.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "After every test you get topic-level accuracy, time-spent breakdowns, weak chapters and a comparison with the topper's attempt.",
  },
  {
    icon: Trophy,
    title: "All-India Rank Predictor",
    description: "See where you stand across thousands of aspirants with percentile, rank and band-wise comparison after every major mock.",
  },
  {
    icon: BookMarked,
    title: "Solutions & Explanations",
    description: "Every question comes with a detailed text + video solution explaining the concept, the trap, and the fastest way to solve it.",
  },
  {
    icon: Zap,
    title: "Auto-Save & Resume",
    description: "Network drop? No problem. Your answers are saved every few seconds — pick up exactly where you left off.",
  },
];

const testTypes = [
  { name: "Chapter Tests", desc: "Master one chapter at a time with focused 30-min tests." },
  { name: "Subject Tests", desc: "Full-length subject quizzes after every module." },
  { name: "Mini Mocks", desc: "1-hour quick mocks to keep you exam-fit." },
  { name: "Full Mocks", desc: "Real-time, real-pattern, real-difficulty full-length tests." },
  { name: "Previous Years", desc: "Solve PYQs from the last 20 years with detailed solutions." },
  { name: "Custom Tests", desc: "Build your own test from chapters and difficulty levels." },
];

const stats = [
  { value: "10,000+", label: "Practice Questions" },
  { value: "500+", label: "Mock Tests" },
  { value: "50+", label: "Previous Year Papers" },
  { value: "24/7", label: "Anytime Access" },
];

const TestsLandingPage = () => {
  const { user } = useAppStore();

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] py-20 md:py-28">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 70% 30%, hsl(38 92% 50% / 0.2) 0%, transparent 50%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Exam-grade testing engine
          </span>
          <h1 className="mt-5 font-display text-4xl font-black leading-tight text-white md:text-6xl">
            Tests built to make you <span className="gradient-text">exam-ready</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 md:text-lg">
            From chapter quizzes to full-length JEE & NEET mocks — practice with the most advanced testing engine in Indian edtech, designed by IIT & AIIMS toppers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? "/my-tests" : "/signup"}
              className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-7 py-3 text-sm font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
            >
              {user ? "Go to My Tests" : "Start Practising Free"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/5 px-7 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
              Browse Courses
            </Link>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-2xl font-black text-white md:text-3xl">{s.value}</p>
                <p className="mt-1 text-[11px] font-medium text-white/60 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Everything in one place</h2>
            <p className="mt-3 text-muted-foreground">Six pillars that make our test engine the most loved by toppers</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover-lift">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Test Types */}
      <section className="bg-card py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Every kind of test you'll ever need</h2>
            <p className="mt-3 text-muted-foreground">Choose your battle — we've got you covered for all of them</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testTypes.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-background p-5 hover-lift">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-foreground">{t.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">How a test works on Arke</h2>
            <p className="mt-3 text-muted-foreground">From the first click to your detailed score report</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { icon: Target, step: "01", title: "Pick your test", desc: "Select chapter, subject or full mock that fits your goal." },
              { icon: Timer, step: "02", title: "Take in real-time", desc: "Full-screen, distraction-free with auto-save every few seconds." },
              { icon: CheckCircle2, step: "03", title: "Submit & analyse", desc: "Instant scores, percentile, and detailed solutions." },
              { icon: TrendingUp, step: "04", title: "Improve weak areas", desc: "Get personalised practice recommendations based on accuracy." },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="absolute -top-3 left-6 rounded-pill bg-gradient-to-r from-primary to-accent px-3 py-0.5 text-[10px] font-black text-white">
                  STEP {s.step}
                </span>
                <s.icon className="mt-3 h-7 w-7 text-primary" />
                <h3 className="mt-3 font-display text-base font-bold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))]" />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 50% 50%, hsl(24 95% 53% / 0.4) 0%, transparent 60%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <Sparkles className="mx-auto h-8 w-8 text-accent mb-4 animate-pulse" />
          <h2 className="font-display text-3xl font-black text-white md:text-5xl">Ready to test your prep?</h2>
          <p className="mt-4 text-lg text-white/90 max-w-lg mx-auto">
            Join 50,000+ students already practising with Arke's smart test engine.
          </p>
          <Link
            to={user ? "/my-tests" : "/signup"}
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-10 py-4 text-lg font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
          >
            {user ? "Open My Tests" : "Start for Free"} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default TestsLandingPage;
