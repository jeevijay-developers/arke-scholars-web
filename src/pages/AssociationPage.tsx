import { Link } from "react-router-dom";
import { Building2, Handshake, GraduationCap, Globe2, Award, ArrowRight, Users, Sparkles } from "lucide-react";

const partners = [
  { name: "IIT Delhi", type: "Institute" },
  { name: "IIT Bombay", type: "Institute" },
  { name: "IIT Kharagpur", type: "Institute" },
  { name: "IIT Madras", type: "Institute" },
  { name: "IIM Ahmedabad", type: "Institute" },
  { name: "AIIMS New Delhi", type: "Institute" },
];

const partnerTypes = [
  {
    icon: GraduationCap,
    title: "Academic Institutes",
    description: "Collaborations with premier institutes (IITs, IIMs, AIIMS) to design rigorous curriculum and mentorship programs.",
  },
  {
    icon: Building2,
    title: "Schools & Coaching Centers",
    description: "We partner with K-12 schools and coaching centers across India and Dubai to bring Arke programs to their students.",
  },
  {
    icon: Globe2,
    title: "Global EdTech Partners",
    description: "Strategic alliances with global education platforms to widen content depth and international exposure.",
  },
  {
    icon: Handshake,
    title: "Corporate & CSR",
    description: "Working with corporates and CSR initiatives to fund scholarships and reach underprivileged students.",
  },
];

const benefits = [
  "Co-branded learning programs",
  "Access to IITian / IIMian / AIIMS mentor network",
  "Custom-built test series & question banks",
  "Live class infrastructure & analytics dashboards",
  "Scholarship & admission support for partner students",
  "Dedicated relationship manager",
];

const AssociationPage = () => {
  return (
    <div className="bg-background">
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
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Partner with Arke</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-foreground mb-4">
            Our <span className="gradient-text">Association</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            We collaborate with the best institutes, schools, and organizations to give every student access to top-tier mentors, content and opportunities.
          </p>
        </div>
      </section>

      {/* Partner logos */}
      <section className="py-12 border-y border-border bg-card/50">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
            Mentors & Curriculum Designers from
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {partners.map((p) => (
              <div
                key={p.name}
                className="rounded-pill border border-border bg-background px-4 py-2 text-sm font-bold text-foreground"
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-3">
              Who we associate with
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From premier institutes to grassroots schools — we build long-term partnerships that put students first.
            </p>
          </div>
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:pb-0">
            {partnerTypes.map((p) => (
              <div
                key={p.title}
                className="relative w-[280px] shrink-0 snap-start scroll-ml-4 md:scroll-ml-0 rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all md:w-auto"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent mb-4">
                  <p.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
              </div>
            ))}
            <div className="w-1 shrink-0 md:hidden" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-card/40 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 mb-4">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Partner Benefits</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">
                What partners get with Arke
              </h2>
              <p className="text-muted-foreground mb-6">
                We bring infrastructure, mentors and a proven program — partners bring students and reach. Together, we unleash potential.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity"
              >
                Become a partner
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-accent p-10 md:p-14 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-black text-primary-foreground mb-3">
              Let's build the future of learning, together.
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Schools, institutes, NGOs and corporates — write to us and we'll set up a partnership conversation within 48 hours.
            </p>
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-pill bg-primary-foreground px-4 py-2.5 text-xs font-bold text-primary hover:opacity-90 transition-opacity sm:px-6 sm:py-3 sm:text-sm"
              >
                Contact Partnerships
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-pill border border-primary-foreground/40 px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-foreground/10 transition-colors sm:px-6 sm:py-3 sm:text-sm"
              >
                About Arke
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AssociationPage;
