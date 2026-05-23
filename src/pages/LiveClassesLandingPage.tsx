import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  Video,
  Users,
  MessageCircle,
  Hand,
  Calendar,
  PlayCircle,
  Sparkles,
  ArrowRight,
  Mic,
  Wifi,
  Award,
  Clock,
  Bell,
  Smartphone,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const features = [
  {
    icon: Video,
    title: "HD Live Streaming",
    description: "Crystal-clear video and audio that works smoothly even on a 2G connection. Built for Indian network conditions.",
  },
  {
    icon: Hand,
    title: "Raise Hand & Ask Live",
    description: "Get your doubts answered in real-time. Raise your hand and your educator will unmute you to discuss live.",
  },
  {
    icon: MessageCircle,
    title: "Live Chat & Polls",
    description: "Chat with the educator and 1,000+ classmates. Take polls, react with emojis and stay engaged throughout.",
  },
  {
    icon: PlayCircle,
    title: "Recordings within 2 Hours",
    description: "Missed a class? Every live session is recorded and uploaded within 2 hours — rewatch as many times as you want.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    description: "Get push, email and WhatsApp reminders 30 minutes before each class. Never miss a session again.",
  },
  {
    icon: Smartphone,
    title: "Watch on Any Device",
    description: "Phone, tablet, laptop — switch between devices seamlessly without losing your spot.",
  },
];

const formats = [
  {
    icon: Users,
    title: "Mega Live Classes",
    description: "1,000+ students learning together with India's best educators. Conceptual lectures + live problem solving.",
    color: "from-primary to-accent",
  },
  {
    icon: Mic,
    title: "Live Doubt Sessions",
    description: "Daily 1-hour sessions where educators clear your doubts on any topic, live with the whiteboard.",
    color: "from-secondary to-secondary",
  },
  {
    icon: Award,
    title: "1-on-1 Mentor Meets",
    description: "Personal weekly meets with a senior mentor — strategy, motivation and a custom study plan tailored for you.",
    color: "from-accent to-primary",
  },
];

const stats = [
  { value: "200+", label: "Live Classes per Month" },
  { value: "50+", label: "Star Educators" },
  { value: "98%", label: "Average Attendance" },
  { value: "<2 hrs", label: "Recording Upload Time" },
];

const LiveClassesLandingPage = () => {
  const { user } = useAppStore();

  return (
    <div className="bg-background">
      <SEO
        title="Live Online Classes for JEE & NEET"
        description="Attend live HD classes with India's top educators for JEE Main, Advanced & NEET. Interactive sessions, recordings available, batch sizes under 50. India & UAE."
        canonical="/live-classes"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Event",
          "name": "ARKE Scholars Live JEE & NEET Classes",
          "description": "Daily live classes for JEE Main, JEE Advanced and NEET by expert educators. Interactive HD sessions with real-time doubt solving.",
          "eventStatus": "https://schema.org/EventScheduled",
          "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
          "location": { "@type": "VirtualLocation", "url": "https://arke.pro/live-classes" },
          "organizer": { "@type": "Organization", "name": "ARKE Scholars", "url": "https://arke.pro" },
          "offers": { "@type": "Offer", "url": "https://arke.pro/pricing", "price": "999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
          "inLanguage": "en"
        }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] py-20 md:py-28">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 70% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 30%, hsl(38 92% 50% / 0.2) 0%, transparent 50%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> Live every single day
          </span>
          <h1 className="mt-5 font-display text-4xl font-black leading-tight text-white md:text-6xl">
            Learn live from <span className="gradient-text">India's best educators</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 md:text-lg">
            Sit in interactive live classes, ask doubts in real-time, and learn from IIT & AIIMS alumni — from anywhere in India or Dubai.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? "/my-live-classes" : "/signup"}
              className="inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-7 py-3 text-sm font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
            >
              {user ? "View My Classes" : "Join the Next Class"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/educators"
              className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/5 px-7 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
              Meet the Educators
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

      {/* Class Formats */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Three ways to learn live</h2>
            <p className="mt-3 text-muted-foreground">Choose the format that suits your learning style</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3 stagger-children">
            {formats.map((f) => (
              <div key={f.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover-lift">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color}`}>
                  <f.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">Built for the live experience</h2>
            <p className="mt-3 text-muted-foreground">Every feature designed so you never miss a beat</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-background p-6 hover-lift">
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

      {/* How it works */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">How live classes work</h2>
            <p className="mt-3 text-muted-foreground">Joining a class is as easy as opening WhatsApp</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { icon: Calendar, step: "01", title: "Check the schedule", desc: "See your weekly timetable in your dashboard with one-tap reminders." },
              { icon: Bell, step: "02", title: "Get notified", desc: "Push, email & WhatsApp ping you 30 mins before each class." },
              { icon: Wifi, step: "03", title: "Join in one click", desc: "Tap to enter — no app downloads, no install, instant access on any device." },
              { icon: PlayCircle, step: "04", title: "Rewatch anytime", desc: "Recording is available in your library within 2 hours of class end." },
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

      {/* Schedule strip */}
      <section className="bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-display text-xl font-bold text-foreground">Classes run 7 days a week</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Morning, afternoon, evening and late-night batches — pick the timing that works for you in IST or GST.
              </p>
            </div>
            <Link
              to={user ? "/my-live-classes" : "/signup"}
              className="rounded-pill bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-bold text-white shadow-blue hover:opacity-90 transition-opacity"
            >
              {user ? "My Schedule" : "See Pricing"}
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))]" />
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 50% 50%, hsl(24 95% 53% / 0.4) 0%, transparent 60%)" }} />
        <div className="container relative z-10 mx-auto px-4 text-center animate-fade-in-up">
          <Sparkles className="mx-auto h-8 w-8 text-accent mb-4 animate-pulse" />
          <h2 className="font-display text-3xl font-black text-white md:text-5xl">Your seat is waiting</h2>
          <p className="mt-4 text-lg text-white/90 max-w-lg mx-auto">
            Sign up free and join your first live class today. No credit card required.
          </p>
          <Link
            to={user ? "/my-live-classes" : "/signup"}
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-gradient-to-r from-primary to-accent px-10 py-4 text-lg font-bold text-white shadow-blue hover:opacity-90 hover:scale-105 transition-all"
          >
            {user ? "Open My Live Classes" : "Join Free"} <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LiveClassesLandingPage;
