import { FileText, Scale, CreditCard, Ban, AlertTriangle, RefreshCcw, Mail } from "lucide-react";
import SEO from "@/components/SEO";

const TermsOfServicePage = () => {
  const sections = [
    {
      icon: FileText,
      title: "Acceptance of Terms",
      content:
        "By creating an account or using Arke, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform. Users under 18 must have parental or guardian consent.",
    },
    {
      icon: Scale,
      title: "Use of the Platform",
      content:
        "Arke is provided for personal, non-commercial educational use. You agree to use the platform lawfully, respect other users and educators, and not misuse content (e.g., redistribution, scraping, or unauthorized recording of live classes).",
    },
    {
      icon: CreditCard,
      title: "Payments & Subscriptions",
      content:
        "Subscription fees are billed in advance based on your selected plan and region (INR for India, AED for UAE). All prices are inclusive of applicable taxes. Auto-renewal applies unless cancelled at least 48 hours before the next billing cycle from your account settings.",
    },
    {
      icon: RefreshCcw,
      title: "Refund Policy",
      content:
        "We offer a 7-day money-back guarantee on all paid plans, no questions asked. After 7 days, refunds may be considered case-by-case for verified service issues. Refunds are processed to the original payment method within 7–10 business days.",
    },
    {
      icon: Ban,
      title: "Account Termination",
      content:
        "We reserve the right to suspend or terminate accounts that violate these terms — including academic dishonesty, abusive behavior toward staff or students, content piracy, or fraudulent payment activity. You may delete your account at any time from your settings page.",
    },
    {
      icon: AlertTriangle,
      title: "Intellectual Property",
      content:
        "All course content, recordings, study materials, tests, and software on Arke are the intellectual property of Arke or its licensed educators. Sharing, reselling, or republishing this content without written permission is strictly prohibited and may result in legal action.",
    },
  ];

  return (
    <div className="bg-background">
      <SEO title="Terms of Service" description="Review ARKE Scholars' terms of service governing your use of our learning platform, including course access, subscriptions, and acceptable use policies." />
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary mb-6">
            <Scale className="h-3.5 w-3.5" /> Fair, transparent terms
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-display gradient-text mb-4">Terms of Service</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Last updated: January 1, 2026 · Please read these terms carefully before using Arke.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-6 mb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of Arke's website,
              mobile application, and services (collectively, the "Platform"). By using Arke,
              you enter into a binding agreement with Arke EdTech Pvt. Ltd. (India) and Arke
              Education FZ-LLC (UAE), depending on your region.
            </p>
          </div>

          <div className="space-y-6">
            {sections.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                    <s.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-black font-display">{i + 1}. {s.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
              </div>
            ))}

            {/* Limitation of liability */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h2 className="text-xl font-black font-display mb-3">7. Limitation of Liability</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Arke provides educational guidance and resources but cannot guarantee specific
                exam outcomes or admissions. To the maximum extent permitted by law, Arke's
                total liability is limited to the amount you paid in the 12 months preceding
                the claim. We are not liable for indirect, incidental, or consequential damages.
              </p>
            </div>

            {/* Changes */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h2 className="text-xl font-black font-display mb-3">8. Changes to These Terms</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We may update these Terms occasionally. Material changes will be communicated
                via email or in-app notification at least 14 days before they take effect.
                Continued use after that date constitutes acceptance of the updated Terms.
              </p>
            </div>

            {/* Governing law */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h2 className="text-xl font-black font-display mb-3">9. Governing Law</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                For users in India, these Terms are governed by the laws of India and disputes
                fall under the exclusive jurisdiction of courts in New Delhi. For users in the
                UAE, these Terms are governed by UAE law with jurisdiction in Dubai courts.
              </p>
            </div>

            {/* Contact */}
            <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-8 text-primary-foreground">
              <Mail className="mb-3 h-8 w-8" />
              <h2 className="text-xl font-black font-display mb-2">Questions about these terms?</h2>
              <p className="text-sm text-primary-foreground/80 mb-4">
                Our legal team is happy to clarify anything that's unclear.
              </p>
              <a
                href="mailto:legal@arke.pro"
                className="inline-flex items-center gap-2 rounded-pill bg-primary-foreground px-6 py-2.5 text-sm font-bold text-primary hover:opacity-90 transition-opacity"
              >
                legal@arke.pro
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsOfServicePage;
