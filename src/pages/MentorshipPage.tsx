import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import {
  GraduationCap,
  Briefcase,
  Stethoscope,
  Sparkles,
  AlertTriangle,
  Compass,
  Video,
  CalendarClock,
  ArrowRight,
  UserPlus,
  UsersRound,
  CheckCircle2,
  Trophy,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mentor data — names + IIT from students.docx, photos from /public/arke/
// ---------------------------------------------------------------------------
const MENTORS: { name: string; college: string; img: string }[] = [
  { name: "Kartikey Mittal", college: "IIT Bombay", img: "/arke/kartikey mittal.jpeg" },
  { name: "Abhishek Kumar Singh", college: "IIT Delhi", img: "/arke/abhishek kumar singh.jpeg" },
  { name: "Ahil Khan", college: "IIT Bombay", img: "/arke/ahil khan.jpeg" },
  { name: "Purushottam Sharma", college: "IIT Delhi", img: "/arke/purushottam sharma.jpeg" },
  { name: "Mayank Motwani", college: "IIT Bombay", img: "/arke/mayank motwani.jpeg" },
  { name: "Aayush", college: "IIT Kanpur · IIM Ahmedabad", img: "/arke/Aayush.png" },
  { name: "Monil Lodha", college: "IIT Kanpur", img: "/arke/Monil lodha.jpeg" },
  { name: "Heyramb Agrawal", college: "IIT Kharagpur", img: "/arke/heyarambh agarwal.jpeg" },
  { name: "Navneet", college: "IIT Delhi", img: "/arke/navneet.jpeg" },
  { name: "Prakkhyaat Prajapat", college: "IIT Delhi", img: "/arke/prakkhyat prajapat.jpeg" },
  { name: "Kanishk Mehta", college: "IIT Guwahati", img: "/arke/kanishk mehta.jpeg" },
  { name: "Parth Sinha", college: "IIT Kharagpur", img: "/arke/parth sinha .jpeg" },
  { name: "Amish Reza", college: "IIT Kanpur", img: "/arke/amish reza.jpeg" },
  { name: "Akshat Rajani", college: "IIT Kanpur", img: "/arke/akshat rajani.jpeg" },
  { name: "Amogh", college: "IIT Delhi", img: "/arke/amogh.png" },
  { name: "Kushagra Gupta", college: "IIT Delhi", img: "/arke/kushagra gupta.jpeg" },
  { name: "Harsh Agrawal", college: "IIT Kanpur", img: "/arke/harsh agarwal.jpeg" },
  { name: "Adil Khan", college: "IIT Delhi", img: "/arke/adil khan.png" },
  { name: "Ankan Sarkar", college: "IIT Bombay", img: "/arke/aankan sarkar.jpeg" },
  { name: "Utkarsh Daga", college: "IIT Bombay", img: "/arke/utkarsh daga .jpeg" },
  { name: "Rushi Patel", college: "IIT Delhi · IIM Ahmedabad", img: "/arke/rushi patel.jpeg" },
  { name: "Akhaj Bansal", college: "IIT Delhi", img: "/arke/akhaj bansal.jpeg" },
  { name: "Rohan Garg", college: "IIT Kanpur", img: "/arke/rohan garg.jpeg" },
  { name: "Vishwajeet Singh Solanki", college: "IIT Kharagpur", img: "/arke/vishwajeet singh solanki.jpeg" },
  { name: "Abhinav Singhal", college: "IIT Kanpur", img: "/arke/abhinav singhal.jpeg" },
  { name: "Spandan Patil", college: "IIT Kanpur", img: "/arke/spandan patil.jpeg" },
  { name: "Kunal Rakhecha", college: "IIT Madras", img: "/arke/kunal rakecha.jpeg" },
  { name: "Krina Paghdhar", college: "IIT Gandhinagar", img: "/arke/krina paghadar.jpeg" },
  { name: "Dhairya Gupta", college: "IIT Kanpur", img: "/arke/dhairya gupta.jpeg" },
  { name: "Suhas Jain", college: "IIT Kharagpur", img: "/arke/suhas jain.jpeg" },
  { name: "Kanishk Singhal", college: "IIT Delhi", img: "/arke/kanisk singhal.jpeg" },
  { name: "Vishwajeet Agarwal", college: "IIT Delhi", img: "/arke/vishwajet agarwal.jpeg" },
  { name: "Riyanshi Patil", college: "IIT Kharagpur", img: "/arke/riyanshi patil.jpeg" },
  { name: "Bharat Sharma", college: "IIT Kanpur", img: "/arke/bharat sharma.jpeg" },
  { name: "Alok Wardhan", college: "IIT BHU Varanasi", img: "/arke/alok wardhan.jpeg" },
  { name: "Sanyam Jain", college: "BITS Pilani", img: "/arke/sanyam jain.jpeg" },
  { name: "Divya Prakash Pandey", college: "IIT Kanpur", img: "/arke/divya prakash pandey.jpeg" },
  { name: "Abhiraj Patil", college: "IIT Bombay", img: "/arke/abhiraj patil.jpeg" },
  { name: "Aarzoo", college: "IIT Kanpur", img: "/arke/aarzo.jpeg" },
  { name: "Krishang", college: "IIT Bombay", img: "/arke/krishang.jpeg" },
  { name: "Utkarsh Sawarn", college: "IIT Kanpur", img: "/arke/utkarsh sawarn.jpeg" },
  { name: "Harsh Katara", college: "IIT Guwahati", img: "/arke/harsh katara.jpeg" },
  { name: "Rasesh Srivastava", college: "IIT Guwahati", img: "/arke/rashesh srivastav.jpeg" },
  { name: "Parth Sakalkale", college: "IIT Delhi", img: "/arke/parth sankala iit delhi.jpeg" },
  { name: "Akshat Pandey", college: "IIT Delhi", img: "/arke/Akshat pandey.jpeg" },
  { name: "Somya Kumar", college: "IIT Kharagpur", img: "/arke/somya kumar.jpeg" },
  { name: "Chinmay Bindlish", college: "IIT Delhi", img: "/arke/chinmay bindlish .jpeg" },
  { name: "Madhav Maheshwari", college: "IIT Delhi", img: "/arke/madhav maheshwari.jpeg" },
  { name: "Ankur Kumar", college: "IIT Kanpur", img: "/arke/ankur kumar.jpeg" },
  { name: "Deependra Patel", college: "IIT Delhi", img: "/arke/dependra patel.jpeg" },
  { name: "Mitali Ritesh Laddha", college: "IIT Kharagpur", img: "/arke/mithali ritesh laddha.jpeg" },
  { name: "Yash Sanjeev", college: "IIT Bombay · Calls: IIM Ahmedabad, Bangalore, Calcutta", img: "/arke/yash sanjeev.jpeg" },
  { name: "Aryan Gupta", college: "IIT Bombay", img: "/arke/aryan gupta.jpeg" },
  { name: "Sankalp", college: "IIT Bombay", img: "/arke/sankalp.jpeg" },
  { name: "Shreyash", college: "IIT Kanpur", img: "/arke/shryensh.jpeg" },
  { name: "Samarth Agarwal", college: "IIT Bombay", img: "/arke/samarth agarwal.jpeg" },
  { name: "Nayan Bele", college: "IIT Kharagpur", img: "/arke/nayan bele .jpeg" },
  { name: "Animesh Baranwal", college: "IIT Bombay", img: "/arke/animesh berenwal.jpeg" },
  { name: "Shinoy Sarkar", college: "IIT Kharagpur", img: "/arke/shinoy sarkar.jpeg" },
  { name: "Aditya Gupta", college: "IIT Bombay", img: "/arke/aditya gupta.jpeg" },
  { name: "Swarali Pawar", college: "IIT Delhi", img: "/arke/swarali pawar.jpeg" },
  { name: "Sahil", college: "IIT Kharagpur", img: "/arke/sahil.jpeg" },
  { name: "Sanyam Garg", college: "IIT Delhi", img: "/arke/sanyam garg.jpeg" },
  { name: "Prakhar Mangal", college: "IIT Delhi", img: "/arke/prakhar mangal.jpeg" },
  { name: "Stuti Singh", college: "IIT Kanpur", img: "/arke/stuti singh.jpeg" },
  { name: "Aditya Mishra", college: "IIT Kanpur", img: "/arke/aditya mishra.jpeg" },
  { name: "Anand Kumar", college: "IIT Kharagpur", img: "/arke/anand kumar iit kanpur.jpeg" },
  { name: "Shlok Mishra", college: "IIT Kanpur", img: "/arke/Shlok Mishra-IIT Kanpur.jpg" },
  { name: "Swastik Singhal", college: "IIT Kanpur", img: "/arke/swastik singhal iit kanpur.jpeg" },
  { name: "Shubham Bihani", college: "IIT Roorkee · IIM Bengaluru", img: "/arke/Shubham Bihani IIT rookee IIM Banglore.jpeg" },
  { name: "Lucky Agrawal", college: "IIT Kanpur", img: "/arke/lucky agarwal.jpeg" },
  { name: "Yash Jain", college: "IIT Bombay", img: "/arke/yash jain.jpeg" },
  { name: "Amit Bhartiya", college: "IIT Bombay", img: "/arke/amit bhartiya.jpeg" },
  { name: "Naman", college: "IISC Bengaluru", img: "/arke/naman-iisc-bengaluru.jpeg" },
  { name: "Pawan Goyal", college: "MIT USA", img: "/arke/pawan-goyal.jpeg" },
];

// Display order for college sections
const COLLEGE_ORDER = [
  "IIT Bombay",
  "IIT Delhi",
  "IIT Kanpur",
  "IIT Kharagpur",
  "IIT Madras",
  "IIT Guwahati",
  "IIT BHU Varanasi",
  "IIT Gandhinagar",
  "IIT Roorkee",
  "BITS Pilani",
  "IISC Bengaluru",
  "IIM Bengaluru",
];

const STUDENT_RANKS: Record<string, number> = {
  "Pawan Goyal": 4,
  "Aditya Gupta": 180,
  "Animesh Baranwal": 78,
  "Ankan Sarkar": 67,
  "Aryan Gupta": 29,
  "Mayank Motwani": 5,
  "Samarth Agarwal": 25,
  "Sankalp": 29,
  "Yash Jain": 27,
  "Yash Sanjeev": 102,
  "Kushagra Gupta": 107,
  "Prakhar Mangal": 95,
  "Purushottam Sharma": 114,
  "Vishwajeet Agarwal": 5,
  "Monil Lodha": 120,
};

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Colour palette per college — header accent + badge
const COLLEGE_THEME: Record<string, { header: string; badge: string }> = {
  "MIT": { header: "text-red-700 dark:text-red-400", badge: "bg-red-500/10 text-red-700 dark:text-red-400" },
  "IIM": { header: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "IIT (Top 200)": { header: "text-yellow-600 dark:text-yellow-400 font-bold", badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  "IIT Bombay": { header: "text-blue-600 dark:text-blue-400", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  "IIT Delhi": { header: "text-orange-600 dark:text-orange-400", badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  "IIT Kanpur": { header: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  "IIT Kharagpur": { header: "text-purple-600 dark:text-purple-400", badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  "IIT Madras": { header: "text-rose-600 dark:text-rose-400", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  "IIT Guwahati": { header: "text-teal-600 dark:text-teal-400", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  "IIT BHU Varanasi": { header: "text-yellow-700 dark:text-yellow-400", badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  "IIT Gandhinagar": { header: "text-indigo-600 dark:text-indigo-400", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  "IIT Roorkee": { header: "text-red-600 dark:text-red-400", badge: "bg-red-500/10 text-red-600 dark:text-red-400" },
  "BITS Pilani": { header: "text-fuchsia-600 dark:text-fuchsia-400", badge: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
  "IISC Bengaluru": { header: "text-teal-600 dark:text-teal-400", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  "IIM Bengaluru": { header: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

function getTheme(college: string) {
  if (college.startsWith("MIT")) return COLLEGE_THEME["MIT"];
  if (college.includes("IIM")) return COLLEGE_THEME["IIM"];
  if (college.startsWith("IIT (Top 200)")) return COLLEGE_THEME["IIT (Top 200)"];

  for (const key of COLLEGE_ORDER) {
    if (college.startsWith(key)) return COLLEGE_THEME[key];
  }
  return { header: "text-foreground", badge: "bg-muted text-muted-foreground" };
}

type Mentor = typeof MENTORS[number] & { rank?: number };

// Group mentors by college, separating MIT, IIM, IIT (Top 200) first,
// then the rest of the colleges.
function groupMentors(mentors: typeof MENTORS): { college: string; members: Mentor[] }[] {
  const mit: Mentor[] = [];
  const iim: Mentor[] = [];
  const top200: Mentor[] = [];
  const others: Mentor[] = [];

  for (const m of mentors) {
    const isMit = m.college.toLowerCase().includes("mit");
    const isIim = m.college.toLowerCase().includes("iim");
    const rank = STUDENT_RANKS[m.name];
    const isTop200 = rank !== undefined && rank <= 200;
    const mentorWithRank = { ...m, rank };

    if (isMit) {
      mit.push(mentorWithRank);
    } else if (isIim) {
      iim.push(mentorWithRank);
    } else if (isTop200) {
      top200.push(mentorWithRank);
    } else {
      others.push(mentorWithRank);
    }
  }

  // Sort groups alphabetically by name, except top200 which is sorted by rank
  mit.sort((a, b) => a.name.localeCompare(b.name));
  iim.sort((a, b) => a.name.localeCompare(b.name));
  top200.sort((a, b) => {
    if (a.rank !== b.rank) {
      return (a.rank ?? 0) - (b.rank ?? 0);
    }
    return a.name.localeCompare(b.name);
  });

  // Group other mentors by college
  const othersMap = new Map<string, Mentor[]>();
  for (const m of others) {
    const keys = COLLEGE_ORDER.filter((c) => m.college.includes(c));
    const effectiveKeys = keys.length > 0 ? keys : [m.college];
    for (const key of effectiveKeys) {
      if (!othersMap.has(key)) othersMap.set(key, []);
      othersMap.get(key)!.push(m);
    }
  }
  for (const group of othersMap.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: { college: string; members: Mentor[] }[] = [];

  if (mit.length > 0) {
    result.push({ college: "MIT", members: mit });
  }
  if (iim.length > 0) {
    result.push({ college: "IIM", members: iim });
  }
  if (top200.length > 0) {
    result.push({ college: "IIT (Top 200)", members: top200 });
  }

  const addedKeys = new Set<string>();

  for (const c of COLLEGE_ORDER) {
    if (c === "IIM Bengaluru" || c === "IIM") continue;
    if (othersMap.has(c)) {
      result.push({ college: c, members: othersMap.get(c)! });
      addedKeys.add(c);
    }
  }

  for (const [key, value] of othersMap.entries()) {
    if (!addedKeys.has(key)) {
      result.push({ college: key, members: value });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mentor card — native lazy loading, zero JS overhead per image
// ---------------------------------------------------------------------------
function MentorCard({ name, college, img, rank }: { name: string; college: string; img: string; rank?: number }) {
  const theme = getTheme(college);
  return (
    <div className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-2 ring-border group-hover:ring-primary/50 transition-all duration-200">
        <img
          src={img}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      </div>
      <p className="text-sm font-bold leading-snug text-foreground">{name}</p>
      <div className="flex flex-col gap-1 items-center">
        <span className={`inline-block rounded-full px-3 py-0.5 text-[10px] font-bold ${theme.badge}`}>
          {college}
        </span>
        {rank !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-0.5 text-[10px] font-black">
            <Trophy className="h-3 w-3 shrink-0" /> AIR {rank}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static page data
// ---------------------------------------------------------------------------
const iitBadges = [
  "IIT (Top 200)", "IIT Delhi", "IIT Bombay", "IIT Kharagpur", "IIT Madras",
  "IIT Kanpur", "IIT Roorkee", "IIM", "MIT",
];

const builders = [
  {
    icon: GraduationCap,
    title: "Engineered by IITians",
    body: "Every module, test engine and learning algorithm is built by IIT graduates who have lived the grind.",
  },
  {
    icon: Briefcase,
    title: "Designed by IIMians",
    body: "The pedagogy, learning paths and student experience are crafted by IIM alumni focused on outcomes.",
  },
  {
    icon: Stethoscope,
    title: "Guided by AIIMS doctors",
    body: "NEET prep is led by AIIMS medicos who understand the discipline a future doctor needs.",
  },
];

const steps = [
  { icon: UserPlus, title: "Enroll", body: "Join Arke and tell us your goal." },
  { icon: UsersRound, title: "Get matched", body: "We pair you with an IITian mentor in your stream." },
  { icon: Video, title: "Meet every 15 days", body: "Direct Google Meet 1:1 with your mentor." },
  { icon: CheckCircle2, title: "Stay on track", body: "Resolve illusions, refine strategy, keep moving." },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const MentorshipPage = () => {
  return (
    <div className="bg-background">
      <SEO
        title="1-on-1 IIT Mentorship for JEE & NEET Aspirants"
        description="Get personal mentorship from IIT toppers for JEE & NEET. Weekly sessions, custom study plans, and dedicated doubt mentors. 28 IIT mentors across Bombay, Delhi, Kanpur."
        canonical="/mentorship"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "1-on-1 IIT Mentorship for JEE",
          "description": "Weekly personal mentoring sessions with IIT toppers for JEE Main, JEE Advanced and NEET aspirants",
          "provider": { "@type": "Organization", "name": "ARKE Scholars", "url": "https://arke.pro" },
          "serviceType": "Educational Mentoring",
          "areaServed": ["IN"],
          "offers": { "@type": "Offer", "url": "https://arke.pro/pricing", "priceCurrency": "INR", "availability": "https://schema.org/InStock" }
        }}
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--navy))] via-[hsl(var(--navy2))] to-[hsl(222,47%,15%)] min-h-screen flex items-center">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(circle at 30% 50%, hsl(24 95% 53% / 0.25) 0%, transparent 60%)" }}
        />
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-pill border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> 1:1 Mentorship Program
            </span>
            <h1 className="mt-6 font-display text-4xl font-black text-white md:text-5xl lg:text-6xl">
              Mentorship by <span className="gradient-text">IIT, IIM & MIT Students</span>
            </h1>
            <p className="mt-5 text-lg text-white/80">
              Arke is programmed and designed directly under toppers from IIT, IIM and MIT. The mentorship you get here
              comes straight from IITians, IIMians & MITians currently studying or passed out from these premier institutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {iitBadges.map((b) => {
                const isAnchor = COLLEGE_ORDER.includes(b) || b === "IIT (Top 200)" || b === "MIT" || b === "IIM";
                const sectionSlug = isAnchor ? `#${toSlug(b)}` : "/signup";
                return isAnchor ? (
                  <a
                    key={b}
                    href={sectionSlug}
                    className="rounded-pill border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                  >
                    {b}
                  </a>
                ) : (
                  <Link
                    key={b}
                    to={sectionSlug}
                    className="rounded-pill border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    {b}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Meet our mentors ─────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">
              Meet our mentors
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              {MENTORS.length}+ IITians who cracked the exam and came back to help you do the same.
            </p>
          </div>

          <div className="mt-14 space-y-14">
            {groupMentors(MENTORS).map(({ college, members }) => {
              const theme = getTheme(college);
              return (
                <div key={college} id={toSlug(college)}>
                  {/* College header */}
                  <div className="mb-6 flex items-center gap-4">
                    <h3 className={`font-display text-2xl font-black ${theme.header}`}>
                      {college}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {members.length} mentor{members.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  {/* Cards — max 4 per row */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {members.map((m) => (
                      <MentorCard key={m.img} name={m.name} college={m.college} img={m.img} rank={m.rank} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Built by toppers */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">
              Built by toppers, for toppers
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Not a generic EdTech. Every part of Arke — code, content, mentorship — is crafted by people who have
              cleared the toughest exams in India.
            </p>
          </div>
          <div className="mt-12 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:pb-0">
            {builders.map(({ icon: Icon, title, body }) => (
              <div key={title} className="w-[280px] shrink-0 snap-start scroll-ml-4 md:scroll-ml-0 rounded-2xl border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md md:w-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
            <div className="w-1 shrink-0 md:hidden" />
          </div>
        </div>
      </section>

      {/* Illusions */}
      <section className="bg-[hsl(var(--navy))] py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-pill border border-destructive/40 bg-destructive/15 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-destructive-foreground">
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> The biggest problem
              </span>
              <h2 className="mt-5 font-display text-xl sm:text-2xl font-black md:text-4xl">
                Most aspirants don&apos;t fail because of syllabus.
                <br />
                They fail because of <span className="gradient-text">illusions.</span>
              </h2>
              <p className="mt-4 text-xs sm:text-sm md:text-base leading-relaxed text-white/75">
                Wrong shortcuts. False confidence. Misleading toppers&apos; advice on the internet. Endless coaching
                drama. These illusions silently eat away months of preparation.
              </p>
              <p className="mt-3 text-xs sm:text-sm md:text-base leading-relaxed text-white/75">
                Our IITian mentors break these illusions in your very first session — because they walked the same path
                two or three years ago.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Compass className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-sm sm:text-base md:text-xl font-bold">Mentorship dissolves illusions</h3>
              </div>
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-white/85">
                {[
                  "Honest weekly direction instead of internet noise",
                  "Strategy reviews from someone who cleared JEE / NEET recently",
                  "Clarity on what to skip — not just what to study",
                  "Real talk about burnout, motivation and self-doubt",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Fortnightly Google Meet */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div className="relative rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Video className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Every 15 days</p>
                  <p className="font-display text-lg font-bold text-foreground">Google Meet · 1:1</p>
                </div>
              </div>
              <div className="mt-6 space-y-3 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Scheduled fortnightly with your assigned IITian mentor.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Non-academic queries: motivation, time management, family pressure, college life.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Strategy check-ins: are you on track, what to fix in the next 15 days.</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">
                Talk to a real IITian — every fortnight, on Google Meet
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Beyond academics, every Arke student gets a direct Google Meet call with their IITian mentor every 15
                days. Use it to clear non-academic queries, calibrate your strategy and stay aligned with your goal.
              </p>
              <Link
                to="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-pill bg-[#F97415] px-6 py-3 text-sm font-bold text-primary-foreground shadow-blue transition-opacity hover:opacity-90"
              >
                Book Your Mentor <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground md:text-4xl">How mentorship works</h2>
            <p className="mt-3 text-base text-muted-foreground">Four simple steps to your IITian mentor.</p>
          </div>
          <div className="mt-12 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-6 pb-4 pt-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:pb-0 md:pt-6">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="relative w-[260px] shrink-0 snap-start scroll-ml-4 md:scroll-ml-0 rounded-2xl border border-border bg-background p-6 text-center shadow-sm md:w-auto">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F97415] px-3 py-0.5 text-[10px] font-black text-primary-foreground z-10">
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

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-primary to-accent p-10 text-center text-primary-foreground shadow-blue">
            <Trophy className="mx-auto h-10 w-10" />
            <h2 className="mt-4 font-display text-3xl font-black md:text-4xl">Get your IITian mentor today</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-primary-foreground/90">
              Stop guessing your way through preparation. Start learning from someone who actually made it.
            </p>
            <div className="mt-7 flex flex-row items-center justify-center gap-2 sm:gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-pill bg-white px-4 py-2.5 text-xs font-bold text-primary transition-transform hover:scale-105 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
              >
                Book Your Mentor <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/40 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 sm:px-7 sm:py-3 sm:text-sm sm:gap-2"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MentorshipPage;
