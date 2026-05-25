import { useState } from "react";
import { Mail, Phone, MapPin, MessageCircle, Send, Clock, Globe, CheckCircle2, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(7, "Phone is required").max(20),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please share a few details").max(2000),
});

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: dup } = await supabase.rpc("enquiry_recently_submitted", {
        _email: parsed.data.email,
        _phone: parsed.data.phone,
      });
      if (dup) {
        toast({ title: "We already have your enquiry", description: "Our team will reach out shortly. Please wait 24 hours before resubmitting.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from("enquiries").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        message: parsed.data.subject ? `[${parsed.data.subject}]\n\n${parsed.data.message}` : parsed.data.message,
        source: "contact",
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Message sent!", description: "We'll reach out to you soon." });
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const offices = [
    {
      flag: "🇮🇳",
      city: "Kota, Rajasthan, India",
      address: "D 801, Ashirwad Anandnam, Shreenathpuram-A, Kota, Rajasthan – 324009",
      phone: "+91 98765 43210",
      hours: "Mon–Sat · 9:00 AM – 8:00 PM IST",
    },
  ];

  const channels = [
    { icon: Mail, label: "Email Support", value: "support@arke.pro", href: "mailto:support@arke.pro" },
    { icon: MessageCircle, label: "WhatsApp", value: "+91 98765 43210", href: "https://wa.me/919876543210" },
    { icon: Phone, label: "Call Us", value: "+91 98765 43210", href: "tel:+919876543210" },
  ];

  return (
    <div className="bg-background">
      <SEO
        title="Contact ARKE Scholars | JEE & NEET Help & Support"
        description="Get in touch with the ARKE Scholars team for admissions, technical support, or partnership enquiries."
        canonical="/contact"
      />
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary mb-4 md:mb-6">
            <MessageCircle className="h-3.5 w-3.5" /> We're here to help
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black font-display gradient-text mb-3 md:mb-6">
            Get in touch
          </h1>
          <p className="mx-auto max-w-2xl text-sm md:text-lg text-muted-foreground px-2">
            Questions about courses, enrollment, careers, or partnerships? We typically reply within 24 hours.
          </p>
        </div>
      </section>

      {/* Quick channels */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="flex items-center gap-3 md:gap-4 rounded-2xl border border-border bg-card p-4 md:p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                <c.icon className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-muted-foreground">{c.label}</div>
                <div className="font-bold text-sm md:text-base truncate">{c.value}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Form + offices */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 grid md:grid-cols-5 gap-6 md:gap-8">
          {/* Form */}
          <div className="md:col-span-3 rounded-3xl border border-border bg-card p-5 md:p-8">
            <h2 className="text-xl md:text-2xl font-black font-display mb-1.5 md:mb-2">Send us a message</h2>
            <p className="text-xs md:text-sm text-muted-foreground mb-5 md:mb-6">Fill the form and our team will reach out shortly.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 md:px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="Aarav Sharma"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 md:px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="you@email.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Phone *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 md:px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 md:px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="How can we help?"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Message *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-background px-3 md:px-4 py-2.5 text-sm focus:border-primary focus:outline-none resize-none"
                  placeholder="Tell us a bit about what you're looking for..."
                />
              </div>
              <button
                type="submit"
                disabled={submitted || submitting}
                className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-6 md:px-8 py-2.5 md:py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : submitted ? (
                  <><CheckCircle2 className="h-4 w-4" /> Sent</>
                ) : (
                  <>Send Message <Send className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>

          {/* Offices */}
          <div className="md:col-span-2 space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 mb-1 md:mb-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="font-bold uppercase text-xs tracking-wider text-muted-foreground">Our Offices</h3>
            </div>
            {offices.map((o) => (
              <div key={o.city} className="rounded-2xl border border-border bg-card p-4 md:p-6">
                <div className="text-2xl md:text-3xl mb-2 md:mb-3">{o.flag}</div>
                <h4 className="font-black text-base md:text-lg mb-2 md:mb-3">{o.city}</h4>
                <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground">
                  <div className="flex gap-2"><MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5 text-primary" /> {o.address}</div>
                  <div className="flex gap-2"><Phone className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5 text-primary" /> {o.phone}</div>
                  <div className="flex gap-2"><Clock className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5 text-primary" /> {o.hours}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
