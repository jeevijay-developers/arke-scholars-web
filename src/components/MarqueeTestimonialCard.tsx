// Marquee carousel of ARKE mentors — name, AIR rank, institute, photo.
// Two rows scroll in opposite directions for a dynamic effect.

import { Trophy } from "lucide-react";

type MentorCard = {
  name: string;
  college: string;
  img: string;
  rank?: number;
};

const avatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=07182E&color=C99A2E&bold=true&size=128`;

// Featured mentors — those with AIR ranks first, then top institutes
const FEATURED: MentorCard[] = [
  { name: "Pawan Goyal", college: "MIT USA", img: "/arke/pawan-goyal.jpeg", rank: 4 },
  { name: "Mayank Motwani", college: "IIT Bombay", img: "/arke/mayank motwani.jpeg", rank: 5 },
  { name: "Vishwajeet Agarwal", college: "IIT Delhi", img: "/arke/vishwajet agarwal.jpeg", rank: 5 },
  { name: "Aryan Gupta", college: "IIT Bombay", img: "/arke/aryan gupta.jpeg", rank: 29 },
  { name: "Sankalp", college: "IIT Bombay", img: "/arke/sankalp.jpeg", rank: 29 },
  { name: "Samarth Agarwal", college: "IIT Bombay", img: "/arke/samarth agarwal.jpeg", rank: 25 },
  { name: "Yash Jain", college: "IIT Bombay", img: "/arke/yash jain.jpeg", rank: 27 },
  { name: "Animesh Baranwal", college: "IIT Bombay", img: "/arke/animesh berenwal.jpeg", rank: 78 },
  { name: "Prakhar Mangal", college: "IIT Delhi", img: "/arke/prakhar mangal.jpeg", rank: 95 },
  { name: "Yash Sanjeev", college: "IIT Bombay · IIM Calls", img: "/arke/yash sanjeev.jpeg", rank: 102 },
  { name: "Kushagra Gupta", college: "IIT Delhi", img: "/arke/kushagra gupta.jpeg", rank: 107 },
  { name: "Purushottam Sharma", college: "IIT Delhi", img: "/arke/purushottam sharma.jpeg", rank: 114 },
  { name: "Monil Lodha", college: "IIT Kanpur", img: "/arke/Monil lodha.jpeg", rank: 120 },
  { name: "Aditya Gupta", college: "IIT Bombay", img: "/arke/aditya gupta.jpeg", rank: 180 },
  // Top institute mentors without rank
  { name: "Kartikey Mittal", college: "IIT Bombay", img: "/arke/kartikey mittal.jpeg" },
  { name: "Abhishek Kumar Singh", college: "IIT Delhi", img: "/arke/abhishek kumar singh.jpeg" },
  { name: "Aayush", college: "IIT Kanpur · IIM Ahmedabad", img: "/arke/Aayush.png" },
  { name: "Rushi Patel", college: "IIT Delhi · IIM Ahmedabad", img: "/arke/rushi patel.jpeg" },
  { name: "Ankan Sarkar", college: "IIT Bombay", img: "/arke/aankan sarkar.jpeg" },
  { name: "Utkarsh Daga", college: "IIT Bombay", img: "/arke/utkarsh daga .jpeg" },
  { name: "Navneet", college: "IIT Delhi", img: "/arke/navneet.jpeg" },
  { name: "Heyramb Agrawal", college: "IIT Kharagpur", img: "/arke/heyarambh agarwal.jpeg" },
  { name: "Naman", college: "IISC Bengaluru", img: "/arke/naman-iisc-bengaluru.jpeg" },
  { name: "Shubham Bihani", college: "IIT Roorkee · IIM Bengaluru", img: "/arke/Shubham Bihani IIT rookee IIM Banglore.jpeg" },
];

// Split into two rows
const ROW1 = FEATURED.slice(0, Math.ceil(FEATURED.length / 2));
const ROW2 = FEATURED.slice(Math.ceil(FEATURED.length / 2));

const MentorCardItem = ({ m }: { m: MentorCard }) => (
  <div className="mx-3 w-52 shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <img
        src={m.img}
        alt={m.name}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatar(m.name); }}
        className="h-14 w-14 rounded-full object-cover border-2 border-border"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{m.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-2">{m.college}</p>
      </div>
    </div>
    {m.rank !== undefined && (
      <div className="mt-3 flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 w-fit">
        <Trophy className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[11px] font-bold text-primary">AIR {m.rank}</span>
      </div>
    )}
  </div>
);

const MarqueeTestimonials = () => {
  return (
    <>
      <style>{`
        @keyframes marqueeScroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-inner { animation: marqueeScroll 30s linear infinite; }
        .marquee-reverse { animation-direction: reverse; }
        .marquee-row:hover .marquee-inner { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-inner { animation: none; }
        }
      `}</style>

      {/* Row 1 — left to right */}
      <div className="marquee-row w-full overflow-hidden relative">
        <div className="marquee-inner flex transform-gpu min-w-[200%] py-3">
          {[...ROW1, ...ROW1].map((m, i) => (
            <MentorCardItem key={i} m={m} />
          ))}
        </div>
      </div>

      {/* Row 2 — right to left */}
      <div className="marquee-row w-full overflow-hidden relative">
        <div className="marquee-inner marquee-reverse flex transform-gpu min-w-[200%] py-3">
          {[...ROW2, ...ROW2].map((m, i) => (
            <MentorCardItem key={i} m={m} />
          ))}
        </div>
      </div>
    </>
  );
};

export default MarqueeTestimonials;
