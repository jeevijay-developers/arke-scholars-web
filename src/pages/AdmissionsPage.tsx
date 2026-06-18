import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  GraduationCap,
  FileText,
  ClipboardCheck,
  Trophy,
  Medal,
  Award,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";

const steps = [
  { icon: GraduationCap, title: "Choose Program", body: "Pick the course aligned with your target exam." },
  { icon: FileText, title: "Submit Application", body: "Fill the simple online form in under 5 minutes." },
  { icon: ClipboardCheck, title: "Scholarship Test", body: "Attempt the Arke Scholarship Test (AST)." },
  { icon: CheckCircle2, title: "Confirm Seat", body: "Pay the discounted fee and start learning." },
];

const tiers = [
  {
    icon: Award,
    name: "Bronze",
    pct: "25%",
    color: "from-amber-700 to-amber-500",
    criteria: ["AST score: 60–74%", "Class average above 75%", "Renewable each term"],
  },
  {
    icon: Medal,
    name: "Silver",
    pct: "50%",
    color: "from-slate-400 to-slate-200",
    criteria: ["AST score: 75–89%", "Class average above 80%", "Includes 1:1 mentor"],
  },
  {
    icon: Trophy,
    name: "Gold",
    pct: "75%",
    color: "from-primary to-accent",
    criteria: ["AST score: 90%+", "Verified topper / olympiad rank", "Full course + premium mentorship"],
  },
];

const eligibility = [
  "Currently in Class 8 to Class 12",
  "Preparing for Schooling, Olympiads or Competitive Exams",
  "Resident of India",
  "Committed to a structured learning plan",
];

const documents = [
  "Latest school report card",
  "Government-issued photo ID (student)",
  "Parent/guardian contact details",
  "Olympiad / competition certificates (if any)",
];

const AdmissionsPage = () => {
  return (
    <div className="bg-background">
      <SEO
        title="Apply for ARKE Scholars — JEE & NEET Scholarship Test"
        description="Apply for the ARKE Scholars Scholarship Test and get up to 100% off on Elite JEE & NEET plans. Bronze, Silver, Gold & Platinum tiers available."
        canonical="/admissions"
      />
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] py-20 md:py-28">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(circle at 70% 40%, hsl(42 63% 48% / 0.25) 0%, transparent 60%)" }}
        />
        <div className="container relative z-10 mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-pill border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> Admissions Open · 2026 Batch
          </span>
          <h1 className="mt-6 font-display text-4xl font-black text-white md:text-5xl lg:text-6xl">
            Admissions & <span className="gradient-text">Scholarships</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">
            Find the right program and apply for merit-based scholarships up to 100%. A simple 4-step process to join
            Arke.
          </p>
          <div className="mt-8 flex flex-row items-center justify-center gap-2 sm:gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-pill bg-gradient-to-r from-accent to-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-blue hover:opacity-90 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
            >
              Apply Now <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 rounded-pill border border-white/30 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
            >
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Talk to a counsellor
            </Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Admission in 4 steps</h2>
            <p className="mt-3 text-base text-muted-foreground">From application to your first class — built to be smooth.</p>
          </div>
          <div className="mt-12 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-6 pb-4 pt-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:pb-0 md:pt-6">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="relative w-[260px] shrink-0 snap-start scroll-ml-4 md:scroll-ml-0 rounded-2xl border border-border bg-card p-6 text-center shadow-sm md:w-auto"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-black text-primary-foreground z-10">
                  STEP {i + 1}
                </div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
            <div className="w-1 shrink-0 md:hidden" />
          </div>
        </div>
      </section>

      {/* Scholarship tiers */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Scholarship tiers</h2>
            <p className="mt-3 text-base text-muted-foreground">
              The Arke Scholarship Test (AST) unlocks up to 100% off course fees.
            </p>
          </div>
          <div className="mt-12 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:pb-0">
            {tiers.map(({ icon: Icon, name, pct, color, criteria }) => (
              <div
                key={name}
                className="relative w-[280px] shrink-0 snap-start scroll-ml-4 md:scroll-ml-0 overflow-hidden rounded-2xl border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md md:w-auto"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <h3 className="font-display text-2xl font-black text-foreground">{name}</h3>
                  <span className="font-display text-3xl font-black gradient-text">{pct}</span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">scholarship</p>
                <ul className="mt-5 space-y-2 text-sm text-foreground">
                  {criteria.map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="w-1 shrink-0 md:hidden" />
          </div>
        </div>
      </section>

      {/* Eligibility & Documents */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-8">
              <h3 className="font-display text-2xl font-bold text-foreground">Eligibility</h3>
              <ul className="mt-5 space-y-3 text-sm text-foreground">
                {eligibility.map((e) => (
                  <li key={e} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-8">
              <h3 className="font-display text-2xl font-bold text-foreground">Documents required</h3>
              <ul className="mt-5 space-y-3 text-sm text-foreground">
                {documents.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-primary to-accent p-10 text-center text-primary-foreground shadow-blue">
            <Trophy className="mx-auto h-10 w-10" />
            <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">Apply today, save up to 100%</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-primary-foreground/90">
              Take the Arke Scholarship Test and join the next batch with the scholarship you deserve.
            </p>
            <div className="mt-7 flex flex-row items-center justify-center gap-2 sm:gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-pill bg-white px-4 py-2.5 text-xs font-bold text-primary transition-transform hover:scale-105 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
              >
                Apply Now <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/40 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
              >
                Talk to counsellor
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdmissionsPage;
