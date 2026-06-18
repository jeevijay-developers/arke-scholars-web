import { Loader2, Flame, Swords, Zap, Users } from "lucide-react";
import { CompeteRating } from "@/hooks/useCompeteRating";
import { SUBJECTS_COMPETE as SUBJECTS } from "@/lib/constants";

const CLASS_LEVELS = ["8", "9", "10", "11", "12", "12th pass"];

type Props = {
  rating: CompeteRating;
  classLevel: string;
  targetExam: string;
  subject: string;
  selectedTopics: string[];
  availableTopics: string[];
  loadingTopics: boolean;
  onClassLevel: (c: string) => void;
  onTargetExam: (e: string) => void;
  onSubject: (s: string) => void;
  onTopicsChange: (topics: string[]) => void;
  onQuickMatch: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  joinCode: string;
  onJoinCodeChange: (c: string) => void;
  busy: boolean;
  exams: string[];
};

function getRankTier(r: number) {
  if (r >= 1600) return { label: "Diamond", color: "text-cyan-300", border: "border-cyan-500/30", bg: "bg-cyan-500/10" };
  if (r >= 1400) return { label: "Gold",    color: "text-yellow-300", border: "border-yellow-500/30", bg: "bg-yellow-500/10" };
  if (r >= 1200) return { label: "Silver",  color: "text-slate-300",  border: "border-slate-400/30",  bg: "bg-slate-400/10"  };
  return              { label: "Bronze",  color: "text-orange-300", border: "border-orange-500/30", bg: "bg-orange-500/10" };
}

const CompeteLobby = ({
  rating, classLevel, targetExam, subject, selectedTopics, availableTopics, loadingTopics,
  onClassLevel, onTargetExam, onSubject, onTopicsChange,
  onQuickMatch, onCreateRoom, onJoinRoom,
  joinCode, onJoinCodeChange, busy, exams,
}: Props) => {
  const tier = getRankTier(rating.rating);
  const total = rating.wins + rating.losses + rating.draws;
  const winRate = total > 0 ? Math.round((rating.wins / total) * 100) : 0;

  const toggleTopic = (t: string) => {
    onTopicsChange(selectedTopics.includes(t)
      ? selectedTopics.filter((x) => x !== t)
      : [...selectedTopics, t]);
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <Swords className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-black font-display text-white">Compete</h1>
        </div>
        <p className="text-xs text-white/50">10 questions · 30 s each · Live ranking</p>
      </div>

      {/* Rank card */}
      <div className={`rounded-xl border ${tier.border} ${tier.bg} px-4 py-3 max-w-md mx-auto`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${tier.color}`}>{tier.label}</p>
            <p className="text-3xl font-black text-white leading-none">{rating.rating}</p>
            <p className="text-[10px] text-white/40 font-medium mt-0.5">ELO Rating</p>
          </div>
          <div className="flex gap-4 text-center shrink-0">
            {[
              { v: rating.wins,   l: "Won"   },
              { v: rating.losses, l: "Lost"  },
              { v: `${winRate}%`, l: "Win %"  },
            ].map(({ v, l }) => (
              <div key={l}>
                <p className="text-base font-black text-white">{v}</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">{l}</p>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <p className="text-base font-black text-white">{rating.current_streak}</p>
              </div>
              <p className="text-[10px] text-white/40 uppercase font-bold">Streak</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {/* Match settings */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Match Settings</p>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Class</p>
            <div className="flex flex-wrap gap-2">
              {CLASS_LEVELS.map((c) => (
                <button key={c} onClick={() => onClassLevel(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${classLevel === c ? "bg-secondary text-secondary-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  {c === "12th pass" ? "12+ Pass" : `Class ${c}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Exam</p>
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <button key={e} onClick={() => {
                  onTargetExam(e);
                  if (subject === "Biology" && e !== "NEET") { onSubject(""); onTopicsChange([]); }
                  if (subject === "Math" && e === "NEET")    { onSubject(""); onTopicsChange([]); }
                }}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${targetExam === e ? "bg-secondary text-secondary-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Subject</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.filter((s) => {
                if (s === "Biology" && targetExam !== "NEET") return false;
                if (s === "Math" && targetExam === "NEET") return false;
                return true;
              }).map((s) => (
                <button key={s} onClick={() => { onSubject(s); onTopicsChange([]); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${subject === s ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
              Topics <span className="normal-case font-normal text-white/30">(optional — empty = all)</span>
            </p>
            {loadingTopics ? (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : availableTopics.length === 0 ? (
              <p className="text-xs text-white/40">No topics for this selection</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((t) => (
                  <button key={t} onClick={() => toggleTopic(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${selectedTopics.includes(t) ? "bg-accent text-accent-foreground" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onQuickMatch}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-accent to-primary px-6 py-4 text-base font-black text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-blue"
        >
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Entering the arena…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" /> Enter the Arena
            </span>
          )}
        </button>

        {/* Friend room section */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 text-center">— or challenge a friend —</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onCreateRoom}
              disabled={busy}
              className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Users className="h-4 w-4 text-accent" /> Create Room
            </button>
            <div className="flex gap-1.5">
              <input
                value={joinCode}
                onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ROOM CODE"
                className="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-3 text-xs font-black tracking-[0.2em] text-white placeholder:text-white/30 outline-none focus:bg-white/15 transition-colors"
              />
              <button
                onClick={() => onJoinRoom(joinCode)}
                disabled={busy || joinCode.length < 4}
                className="rounded-xl bg-secondary px-3 py-3 text-xs font-black text-secondary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompeteLobby;
