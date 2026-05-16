import { Shield, Lock, Eye, Database, Cookie, UserCheck, Mail } from "lucide-react";

const PrivacyPolicyPage = () => {
  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: [
        "Account information: name, email, phone number, date of birth, and target exam.",
        "Learning data: courses enrolled, lessons watched, tests attempted, scores, and progress.",
        "Payment information: processed securely via PCI-compliant gateways (Razorpay in India, Stripe in UAE). We do not store full card details.",
        "Device & usage data: device type, browser, IP address, and pages visited — used to improve performance and security.",
      ],
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: [
        "Deliver classes, tests, and personalized recommendations.",
        "Send important updates about your account, classes, and exam schedules.",
        "Provide customer support and resolve issues.",
        "Improve our platform through aggregated analytics.",
        "Comply with legal obligations in India and UAE.",
      ],
    },
    {
      icon: Lock,
      title: "How We Protect Your Data",
      content: [
        "All data is encrypted in transit (TLS 1.3) and at rest (AES-256).",
        "Access is restricted on a need-to-know basis with multi-factor authentication for staff.",
        "Regular third-party security audits and vulnerability assessments.",
        "Servers hosted in compliance with Indian and UAE data residency requirements.",
      ],
    },
    {
      icon: UserCheck,
      title: "Your Rights",
      content: [
        "Access: request a copy of all personal data we hold about you.",
        "Correction: update inaccurate information from your profile settings or by contacting us.",
        "Deletion: request permanent deletion of your account and associated data.",
        "Portability: export your learning data in a machine-readable format.",
        "Withdraw consent: opt out of marketing emails at any time via the unsubscribe link.",
      ],
    },
    {
      icon: Cookie,
      title: "Cookies & Tracking",
      content: [
        "Essential cookies: required for login, security, and core functionality.",
        "Analytics cookies: help us understand how the platform is used (anonymized).",
        "Preference cookies: remember your region (India/Dubai), theme, and language.",
        "You can disable non-essential cookies via your browser settings.",
      ],
    },
    {
      icon: Shield,
      title: "Sharing Your Information",
      content: [
        "We never sell your personal data to third parties.",
        "Trusted service providers (payment processors, email providers, video infrastructure) only receive the minimum data needed to perform their service.",
        "Legal disclosures: we may share data when required by law in India or UAE.",
        "Business transfers: in the event of a merger or acquisition, your data continues to be protected under this policy.",
      ],
    },
  ];

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary mb-6">
            <Shield className="h-3.5 w-3.5" /> Your privacy matters
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-display gradient-text mb-4">Privacy Policy</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Last updated: January 1, 2026 · This policy explains what data Arke collects,
            how we use it, and the choices you have.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-6 mb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Arke ("we", "our", "us") operates educational services across India and the United Arab Emirates.
              We are committed to protecting your privacy and complying with applicable data protection laws,
              including India's Digital Personal Data Protection Act (DPDPA) 2023 and the UAE Personal Data Protection Law.
            </p>
          </div>

          <div className="space-y-6">
            {sections.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                    <s.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-black font-display">{i + 1}. {s.title}</h2>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {s.content.map((c, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Children */}
            <div className="rounded-2xl border border-border bg-card p-8">
              <h2 className="text-xl font-black font-display mb-3">7. Students Under 18</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Many Arke students are minors. We require verifiable parental consent for users
                under 18 in line with DPDPA. Parents can review, modify, or request deletion of
                their child's data at any time by writing to <a href="mailto:privacy@arke.pro" className="text-primary font-semibold">privacy@arke.pro</a>.
              </p>
            </div>

            {/* Contact */}
            <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-8 text-primary-foreground">
              <Mail className="mb-3 h-8 w-8" />
              <h2 className="text-xl font-black font-display mb-2">Questions about your data?</h2>
              <p className="text-sm text-primary-foreground/80 mb-4">
                Reach out to our Data Protection Officer for any privacy-related concerns.
              </p>
              <a
                href="mailto:privacy@arke.pro"
                className="inline-flex items-center gap-2 rounded-pill bg-primary-foreground px-6 py-2.5 text-sm font-bold text-primary hover:opacity-90 transition-opacity"
              >
                privacy@arke.pro
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicyPage;
