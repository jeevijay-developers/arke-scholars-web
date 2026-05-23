import { Link } from "react-router-dom";
import { Check, X, Sparkles, Crown, Rocket, Shield, Zap, HelpCircle, ChevronDown, IndianRupee } from "lucide-react";
import SEO from "@/components/SEO";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";

const PricingPage = () => {
  const { country } = useAppStore();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currency = country === "india" ? "₹" : "AED ";
  const yearlyDiscount = 0.8; // 20% off

  const formatPrice = (monthly: number) => {
    if (monthly === 0) return "Free";
    const price = billing === "yearly" ? Math.round(monthly * 12 * yearlyDiscount) : monthly;
    return `${currency}${price.toLocaleString(country === "india" ? "en-IN" : "en-AE")}`;
  };

  const plans = [
    {
      name: "Explorer",
      tagline: "Get a feel for Arke",
      icon: Sparkles,
      monthly: 0,
      gradient: "from-muted to-muted",
      popular: false,
      cta: "Start Free",
      features: [
        { label: "5 free live classes per month", included: true },
        { label: "Basic test series (10 tests)", included: true },
        { label: "Community doubt solving", included: true },
        { label: "Mobile app access", included: true },
        { label: "AI Doubt Solver", included: false },
        { label: "Detailed analytics", included: false },
        { label: "1-on-1 mentoring", included: false },
      ],
    },
    {
      name: "Pro",
      tagline: "Best for serious aspirants",
      icon: Rocket,
      monthly: country === "india" ? 999 : 149,
      gradient: "from-primary to-accent",
      popular: true,
      cta: "Get Pro",
      features: [
        { label: "Unlimited live classes", included: true },
        { label: "Full test series + mock papers", included: true },
        { label: "AI Doubt Solver (unlimited)", included: true },
        { label: "Performance analytics & rank predictor", included: true },
        { label: "Recorded lectures library", included: true },
        { label: "Priority email support", included: true },
        { label: "1-on-1 mentoring", included: false },
      ],
    },
    {
      name: "Elite",
      tagline: "Personalised, top-tier coaching",
      icon: Crown,
      monthly: country === "india" ? 3999 : 599,
      gradient: "from-accent to-primary-dark",
      popular: false,
      cta: "Go Elite",
      features: [
        { label: "Everything in Pro", included: true },
        { label: "Weekly 1-on-1 mentoring sessions", included: true },
        { label: "Personalised study plan", included: true },
        { label: "Dedicated doubt mentor", included: true },
        { label: "Parent progress reports", included: true },
        { label: "24/7 priority support", included: true },
        { label: "Guaranteed scholarship test access", included: true },
      ],
    },
  ];

  const guarantees = [
    { icon: Shield, title: "7-day money back", desc: "Not satisfied? Full refund within 7 days, no questions asked." },
    { icon: Zap, title: "Instant access", desc: "Start learning the moment your payment is confirmed." },
    { icon: Crown, title: "Cancel anytime", desc: "No long-term lock-ins. Pause or cancel from your dashboard." },
  ];

  const compare = [
    { feature: "Live classes per month", explorer: "5", pro: "Unlimited", elite: "Unlimited" },
    { feature: "Mock test series", explorer: "10", pro: "Full series", elite: "Full series + custom" },
    { feature: "AI Doubt Solver", explorer: "—", pro: "Unlimited", elite: "Unlimited" },
    { feature: "Recorded lectures", explorer: "—", pro: "Full library", elite: "Full library" },
    { feature: "Analytics dashboard", explorer: "Basic", pro: "Advanced", elite: "Advanced + insights" },
    { feature: "1-on-1 mentoring", explorer: "—", pro: "—", elite: "Weekly" },
    { feature: "Parent reports", explorer: "—", pro: "Monthly", elite: "Weekly" },
    { feature: "Support", explorer: "Community", pro: "Priority email", elite: "24/7 dedicated" },
  ];

  const faqs = [
    { q: "Can I switch between plans?", a: "Yes! You can upgrade or downgrade any time from your dashboard. Pro-rated billing applies on upgrades." },
    { q: "Is the yearly plan really 20% cheaper?", a: "Yes. Choosing yearly billing saves you 20% compared to paying monthly — a great deal if you're committed for the long haul." },
    { q: "Do you offer scholarships?", a: "Absolutely. We run a monthly scholarship test giving up to 100% off Elite plans for top performers and need-based students." },
    { q: "What payment methods do you accept?", a: country === "india" ? "UPI, debit/credit cards, net banking, and EMI options on UPI/cards via Razorpay." : "All major credit/debit cards and Apple/Google Pay via Stripe." },
    { q: "Can my parents pay for me?", a: "Yes, anyone can pay using your account. We also send GST-compliant invoices for parents and employer reimbursements." },
    { q: "Is there a refund policy?", a: "Yes — every paid plan comes with a 7-day no-questions-asked refund window from the date of purchase." },
  ];

  return (
    <div className="bg-background">
      <SEO
        title="Affordable JEE & NEET Online Coaching Plans"
        description="Explore ARKE Scholars pricing plans — from free to Elite mentorship. JEE/NEET prep from ₹999/month. 7-day money-back guarantee. Compare Explorer, Pro & Elite."
        canonical="/pricing"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "ARKE Scholars Pro Plan",
          "description": "Unlimited live classes, full test series, AI doubt solver, and performance analytics for JEE, NEET & Board exams",
          "url": "https://arke.pro/pricing",
          "brand": { "@type": "Brand", "name": "ARKE Scholars" },
          "offers": [
            { "@type": "Offer", "name": "Pro Monthly", "price": "999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
            { "@type": "Offer", "name": "Pro Yearly", "price": "9590", "priceCurrency": "INR", "availability": "https://schema.org/InStock" }
          ]
        }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
            <IndianRupee className="h-3.5 w-3.5" /> Transparent pricing · No hidden fees
          </span>
          <h1 className="mt-6 text-4xl font-black font-display text-foreground md:text-6xl">
            Affordable Plans for <span className="gradient-text">JEE, NEET & Boards</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Start free, upgrade only when you're ready. Every plan is built to help you crack JEE, NEET, and Board exams without breaking the bank.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center rounded-pill border border-border bg-card p-1 shadow-sm">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-pill px-5 py-2 text-sm font-bold transition-colors ${billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`rounded-pill px-5 py-2 text-sm font-bold transition-colors ${billing === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Yearly
              <span className="ml-2 rounded-pill bg-secondary/20 px-2 py-0.5 text-[10px] font-black text-secondary">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.name}
                  className={`relative rounded-2xl border p-8 transition-transform hover:-translate-y-1 ${
                    p.popular
                      ? "border-primary bg-card shadow-blue"
                      : "border-border bg-card shadow-sm"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-gradient-to-r from-primary to-accent px-4 py-1 text-xs font-bold text-primary-foreground">
                      Most Popular
                    </span>
                  )}
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${p.gradient}`}>
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold font-display text-foreground">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                  <div className="mt-6">
                    <span className="text-4xl font-black font-display text-foreground">
                      {formatPrice(p.monthly)}
                    </span>
                    {p.monthly > 0 && (
                      <span className="ml-1 text-sm text-muted-foreground">
                        /{billing === "yearly" ? "year" : "month"}
                      </span>
                    )}
                  </div>
                  {p.monthly > 0 && billing === "yearly" && (
                    <p className="mt-1 text-xs text-secondary font-semibold">
                      That's {currency}{Math.round(p.monthly * yearlyDiscount).toLocaleString()}/mo
                    </p>
                  )}
                  <Link
                    to="/signup"
                    className={`mt-6 block rounded-pill py-3 text-center text-sm font-bold transition-colors ${
                      p.popular
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                        : "border border-border text-foreground hover:bg-primary/5"
                    }`}
                  >
                    {p.cta}
                  </Link>
                  <ul className="mt-8 space-y-3">
                    {p.features.map((f) => (
                      <li key={f.label} className="flex items-start gap-2 text-sm">
                        {f.included ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        ) : (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                        )}
                        <span className={f.included ? "text-foreground" : "text-muted-foreground/70 line-through"}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="bg-card py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {guarantees.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.title} className="rounded-2xl border border-border bg-background p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 font-bold font-display text-foreground">{g.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compare table */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-black font-display text-foreground md:text-4xl">Compare plans in detail</h2>
            <p className="mt-2 text-muted-foreground">Everything you get, side by side.</p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left font-bold text-foreground">Feature</th>
                  <th className="px-6 py-4 text-center font-bold text-foreground">Explorer</th>
                  <th className="px-6 py-4 text-center font-bold text-primary">Pro</th>
                  <th className="px-6 py-4 text-center font-bold text-foreground">Elite</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-background" : "bg-card"}>
                    <td className="px-6 py-4 font-medium text-foreground">{row.feature}</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">{row.explorer}</td>
                    <td className="px-6 py-4 text-center font-semibold text-foreground">{row.pro}</td>
                    <td className="px-6 py-4 text-center font-semibold text-foreground">{row.elite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card py-16 md:py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-black font-display text-foreground md:text-4xl">Pricing FAQs</h2>
            <p className="mt-2 text-muted-foreground">Got questions? We've got answers.</p>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((f, i) => (
              <div key={f.q} className="overflow-hidden rounded-xl border border-border bg-background">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="flex items-center gap-3 font-semibold text-foreground">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-accent p-10 text-center md:p-16">
            <h2 className="text-3xl font-black font-display text-primary-foreground md:text-4xl">
              Ready to start your prep journey?
            </h2>
            <p className="mt-3 text-primary-foreground/80">
              Join thousands of students already learning on Arke. Start free — upgrade whenever you're ready.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="rounded-pill bg-primary-foreground px-6 py-3 text-sm font-bold text-primary hover:opacity-90 transition-opacity"
              >
                Start Free
              </Link>
              <Link
                to="/courses"
                className="rounded-pill border border-primary-foreground/40 px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
              >
                Browse Courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
