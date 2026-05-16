import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Star,
  Video,
  BookOpen,
  MessageCircle,
  Search,
  Award,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Users,
  Briefcase,
  Heart,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEducators } from "@/hooks/useEducators";

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("") || "?";

// Curated fallback educators shown only when no real teacher accounts exist yet.
const fallbackEducators = [
  { id: "f1", name: "Vikram Thapar", subject: "Physics", rating: 4.9, students: 12400, classes: 340, exp: "12 yrs", speciality: "IIT JEE Advanced" },
  { id: "f2", name: "Ananya Iyer", subject: "Mathematics", rating: 4.9, students: 11200, classes: 310, exp: "15 yrs", speciality: "Calculus & Algebra" },
  { id: "f3", name: "Siddharth Nair", subject: "Chemistry", rating: 4.8, students: 9800, classes: 290, exp: "10 yrs", speciality: "Organic Chemistry" },
  { id: "f4", name: "Kavitha Menon", subject: "Biology", rating: 4.7, students: 8500, classes: 250, exp: "8 yrs", speciality: "NEET Biology" },
];

const stats = [
  { value: "120+", label: "Star Educators" },
  { value: "IIT/AIIMS", label: "Pedigree" },
  { value: "10+ yrs", label: "Average Experience" },
  { value: "4.8★", label: "Avg Rating" },
];

const highlights = [
  {
    icon: GraduationCap,
    title: "Top-tier Pedigree",
    description: "Every educator is from IIT, AIIMS, NIT or has 10+ years of teaching experience at India's top coaching institutes.",
  },
  {
    icon: ShieldCheck,
    title: "Vetted by Students",
    description: "Educators must maintain a 4.5★ rating from real students. Underperformers don't make the cut.",
  },
  {
    icon: Heart,
    title: "Mentors, not just teachers",
    description: "Our faculty go beyond lectures — they mentor you on strategy, motivation, and exam temperament.",
  },
  {
    icon: Briefcase,
    title: "1-on-1 Access",
    description: "Book personal sessions with any educator for doubts, mentorship, or career guidance.",
  },
  {
    icon: Award,
    title: "Result-driven",
    description: "Our educators have produced 200+ AIRs in JEE/NEET in the last 5 years alone.",
  },
  {
    icon: Users,
    title: "Built a community",
    description: "Live chat, group doubt sessions and educator-led study circles keep you engaged daily.",
  },
];

const EducatorsPage = () => {
  const { user } = useAppStore();
  const [search, setSearch] = useState("");
  const { educators: dbEducators, loading } = useEducators();

  // Use real educators when available, otherwise show curated fallback so the
  // marketing page never appears empty before any teachers are onboarded.
  const list = dbEducators.length > 0
    ? dbEducators.map((e) => ({
        id: e.user_id,
        name: e.full_name,
        subject: e.subject || "Faculty",
        rating: 4.8,
        students: 0,
        classes: 0,
        exp: "—",
        speciality: e.city || "Educator",
        avatar_url: e.avatar_url,
      }))
    : fallbackEducators.map((f) => ({ ...f, avatar_url: null as string | null }));

  const filtered = list.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] py-20 md:py-28">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 70% 30%, hsl(38 92% 50% / 0.2) 0%, transparent 50%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Learn from India's finest faculty
          </span>
          <h1 className="mt-5 font-display text-4xl font-black leading-tight text-white md:text-6xl">
            Meet the educators who <span className="gradient-text">change lives</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 md:text-lg">
            Hand-picked IIT, AIIMS &amp; NIT alumni with a decade of teaching experience.
            They don't just teach — they mentor you to your dream rank.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-7 py-3 text-sm font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
            >
              {user ? "Go to Dashboard" : "Start Learning"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/live-classes"
              className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/5 px-7 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
              See Live Classes
            </Link>
          </div>

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

      {/* Why our educators */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Why our faculty stand out</h2>
            <p className="mt-3 text-muted-foreground">A team curated for credentials, clarity and care</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {highlights.map((f) => (
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

      {/* Featured educators directory */}
      <section className="bg-card py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Featured educators</h2>
            <p className="mt-3 text-muted-foreground">Browse our star faculty and book a session</p>
          </div>

          <div className="relative mx-auto mt-8 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or subject..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {loading && (
              <div className="col-span-full flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {!loading && filtered.map((edu) => (
              <div key={edu.id} className="rounded-xl border border-border bg-background p-5 hover-lift">
                <div className="mb-4 flex items-center gap-3">
                  {edu.avatar_url ? (
                    <img src={edu.avatar_url} alt={edu.name} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">
                      {initialsOf(edu.name)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{edu.name}</h3>
                    <p className="text-xs text-muted-foreground">{edu.subject} · {edu.exp}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold text-foreground">{edu.rating}</span>
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Speciality: {edu.speciality}</p>
                <div className="mb-4 flex gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {edu.classes} classes</span>
                  <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {edu.students.toLocaleString()} students</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={user ? "/dashboard" : "/signup"}
                    className="flex-1 rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Book 1-on-1
                  </Link>
                  <Link
                    to={user ? "/doubts" : "/signup"}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <MessageCircle className="h-3 w-3" /> Message
                  </Link>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                No educators match your search.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))]" />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 50% 50%, hsl(24 95% 53% / 0.4) 0%, transparent 60%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <Sparkles className="mx-auto mb-4 h-8 w-8 animate-pulse text-accent" />
          <h2 className="font-display text-3xl font-black text-white md:text-5xl">
            Learn from the best, become the best
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/90">
            Join 50,000+ students learning live with India's top educators.
          </p>
          <Link
            to={user ? "/dashboard" : "/signup"}
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-10 py-4 text-lg font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
          >
            {user ? "Open My Dashboard" : "Get Started Free"} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default EducatorsPage;
