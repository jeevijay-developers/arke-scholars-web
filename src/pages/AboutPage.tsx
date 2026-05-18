import { Link } from "react-router-dom";
import { Flame, Target, Heart, Globe, Users, Sparkles, ArrowRight, GraduationCap, Award, Building2 } from "lucide-react";

const AboutPage = () => {
  const values = [
    { icon: Heart, title: "Student First", desc: "Every decision starts with what helps the learner — clarity, outcomes, and confidence." },
    { icon: Target, title: "Outcome Obsessed", desc: "We measure ourselves by results: ranks, scores, admits — not vanity metrics." },
    { icon: Sparkles, title: "Craft & Quality", desc: "Polished products, careful curriculum, calm interfaces. Details matter." },
    { icon: Globe, title: "Borderless Learning", desc: "Built for India and Dubai from day one — same quality, local context." },
  ];

  const stats = [
    { value: "50K+", label: "Students Learning" },
    { value: "120+", label: "Master Educators" },
    { value: "2", label: "Countries Served" },
    { value: "98%", label: "Satisfaction Rate" },
  ];

  const milestones = [
    { year: "2024", title: "Arke Founded", desc: "Started in Kota with a mission to rebuild test-prep around clarity." },
    { year: "2025", title: "Dubai Expansion", desc: "Launched UAE operations to serve NRI students preparing for Indian exams." },
    { year: "2026", title: "AI-Native Platform", desc: "Rolled out AI Doubt Solver and personalized study planners across all subjects." },
  ];

  const pillars = [
    { icon: GraduationCap, title: "Master Educators", desc: "Award-winning faculty with decades of mentoring top ranks." },
    { icon: Award, title: "Product & Engineering", desc: "Designers and engineers from leading consumer companies." },
    { icon: Building2, title: "Student Success", desc: "Counselors and operators who walk with every student." },
  ];

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary mb-4 md:mb-6">
            <Flame className="h-3.5 w-3.5" /> Crafted in Kota · Built for the world
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black font-display gradient-text mb-4 md:mb-6 leading-tight">
            We're rebuilding test-prep<br className="hidden sm:block" />
            <span className="sm:hidden"> </span>from the ground up
          </h1>
          <p className="mx-auto max-w-2xl text-sm md:text-lg text-muted-foreground leading-relaxed px-2">
            Arke exists to give every ambitious student — wherever they are — access to India's
            best educators, calm tools, and outcomes that change lives.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/30 py-8 md:py-10">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl md:text-4xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-pill bg-accent/10 px-3 py-1 text-xs font-bold text-accent mb-3 md:mb-4">
              <Target className="h-3.5 w-3.5" /> Our Mission
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display mb-4 md:mb-6 leading-snug">
              Outcomes shouldn't depend on your pin code.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4 leading-relaxed">
              For decades, the best teachers, the best test series, and the best peer groups
              were trapped inside a few cities. We're untying that knot — bringing master
              educators, structured practice, and live classrooms to anyone with an internet
              connection.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Whether you're a Class 8 student in Kota or a JEE aspirant in Dubai, you deserve
              the same shot at your dream rank.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-4 md:p-6 hover:border-primary/40 transition-colors">
                <div className="mb-2 md:mb-3 inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <v.icon className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">{v.title}</h3>
                <p className="text-[11px] md:text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-card/30 py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display mb-2 md:mb-3">Our journey so far</h2>
            <p className="text-sm md:text-base text-muted-foreground">Small team, big ambition, faster every year.</p>
          </div>
          <div className="mx-auto max-w-3xl space-y-4 md:space-y-6">
            {milestones.map((m) => (
              <div key={m.year} className="flex gap-4 md:gap-6 rounded-2xl border border-border bg-card p-4 md:p-6">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-black text-sm md:text-base">
                    {m.year}
                  </div>
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold mb-1">{m.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership pillars */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display mb-2 md:mb-3">Built by people who care</h2>
            <p className="text-sm md:text-base text-muted-foreground">Educators, engineers, and operators working as one team.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center">
                <div className="mx-auto mb-3 md:mb-4 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                  <p.icon className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
                </div>
                <h3 className="text-base md:text-lg font-bold mb-1 md:mb-2">{p.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-primary to-accent p-8 md:p-12 text-center text-primary-foreground">
            <Users className="mx-auto mb-3 md:mb-4 h-9 w-9 md:h-12 md:w-12" />
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-display mb-2 md:mb-3 leading-snug">
              Want to build the future of learning with us?
            </h2>
            <p className="mb-6 md:mb-8 text-sm md:text-base text-primary-foreground/80">
              We're hiring educators, engineers, and creators across India and Dubai.
            </p>
            <Link
              to="/career"
              className="inline-flex items-center gap-2 rounded-pill bg-primary-foreground px-6 py-2.5 md:px-8 md:py-3 text-sm font-bold text-primary hover:opacity-90 transition-opacity"
            >
              Explore Careers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
