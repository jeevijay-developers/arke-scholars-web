import { useEffect, useState } from "react";
import { X, Swords } from "lucide-react";

const MESSAGES = [
  "Scanning the battlefield…",
  "Locking onto a worthy rival…",
  "Your opponent is loading up…",
  "Calibrating the challenge…",
  "Arena is prepping for you…",
  "Searching across challengers…",
  "Finding your perfect match…",
  "Stand by — rival incoming…",
];

type Props = {
  onCancel: () => void;
  roomCode?: string | null;
};

const CompeteSearching = ({ onCancel, roomCode }: Props) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const message = MESSAGES[Math.floor(elapsed / 3) % MESSAGES.length];

  return (
    <div className="text-center space-y-6 py-10 animate-fade-in-up">
      <div className="relative h-32 w-32 mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 animate-ping opacity-40" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
          <Swords className="h-10 w-10 text-white" />
        </div>
      </div>

      {roomCode ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/50">Share with a friend</p>
          <p className="text-5xl font-black tracking-[0.35em] text-white font-display">{roomCode}</p>
          <p className="text-sm text-white/60">Waiting for your challenger…</p>
          <p className="text-xs text-white/30">{elapsed}s</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-lg font-black text-white">{message}</p>
          <p className="text-xs text-white/30">{elapsed}s</p>
        </div>
      )}

      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
      >
        <X className="h-3.5 w-3.5" /> Cancel
      </button>
    </div>
  );
};

export default CompeteSearching;
