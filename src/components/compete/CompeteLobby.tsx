import { Trophy, Flame, Star, Swords } from "lucide-react";
import { CompeteRating } from "@/hooks/useCompeteRating";

import { SUBJECTS_COMPETE as SUBJECTS } from "@/lib/constants";
const TOPICS: Record<string, string[]> = {
  Physics: ["Any", "Kinematics", "Laws of Motion"],
  Chemistry: ["Any", "Atomic Structure", "Periodic Table", "Mole Concept"],
  Math: ["Any", "Algebra", "Trigonometry", "Calculus"],
  Biology: ["Any", "Cell", "Human Physiology"],
};

type Props = {
  rating: CompeteRating;
  subject: string;
  topic: string;
  onSubject: (s: string) => void;
  onTopic: (t: string) => void;
  onQuickMatch: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onPracticeBot: () => void;
  joinCode: string;
  onJoinCodeChange: (c: string) => void;
  busy: boolean;
};

const CompeteLobby = ({
  rating, subject, topic, onSubject, onTopic,
  onQuickMatch, onCreateRoom, onJoinRoom, onPracticeBot,
  joinCode, onJoinCodeChange, busy,
}: Props) => {
  const topics = TOPICS[subject] ?? ["Any"];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="text-center">
        <h1 className="text-2xl font-black font-display text-white flex items-center justify-center gap-2">
          <Swords className="h-7 w-7 text-accent" /> Compete
        </h1>
        <p className="text-xs text-white/70 mt-1">Battle a peer · 10 questions · 30s each</p>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
        <Stat icon={<Trophy className="h-4 w-4 text-accent" />} label="Rating" value={String(rating.rating)} />
        <Stat icon={<Star className="h-4 w-4 text-accent" />} label="Wins" value={String(rating.wins)} />
        <Stat icon={<Flame className="h-4 w-4 text-primary" />} label="Streak" value={String(rating.current_streak)} />
      </div>

      <div className="max-w-md mx-auto space-y-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Subject</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => { onSubject(s); onTopic("Any"); }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${subject === s ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Topic</p>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => onTopic(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${topic === t ? "bg-accent text-accent-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
              >{t}</button>
            ))}
          </div>
        </div>

        <button
          onClick={onQuickMatch}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-4 text-base font-black text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy ? "Working..." : "Find Opponent"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCreateRoom}
            disabled={busy}
            className="rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 transition-colors"
          >Create Room</button>
          <button
            onClick={onPracticeBot}
            disabled={busy}
            className="rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 transition-colors"
          >Practice vs Bot</button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={joinCode}
            onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ROOM CODE"
            className="flex-1 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-bold tracking-widest text-white placeholder:text-white/40 outline-none focus:bg-white/15"
          />
          <button
            onClick={() => onJoinRoom(joinCode)}
            disabled={busy || joinCode.length < 4}
            className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground hover:opacity-90 disabled:opacity-50"
          >Join</button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
    <div className="flex items-center justify-center gap-1">{icon}<span className="text-base font-black text-white">{value}</span></div>
    <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mt-0.5">{label}</p>
  </div>
);

export default CompeteLobby;
