import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type Props = {
  onCancel: () => void;
  onBotFallback: () => void;
  roomCode?: string | null;
};

const CompeteSearching = ({ onCancel, onBotFallback, roomCode }: Props) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-center space-y-5 py-10 animate-fade-in-up">
      <div className="relative h-32 w-32 mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
      </div>

      {roomCode ? (
        <>
          <p className="text-sm text-white/70">Share this room code with a friend</p>
          <p className="text-4xl font-black tracking-[0.3em] text-white font-display">{roomCode}</p>
          <p className="text-xs text-white/50">Waiting for opponent... {seconds}s</p>
        </>
      ) : (
        <>
          <p className="text-base font-bold text-white">Searching for opponent...</p>
          <p className="text-xs text-white/60">Time: {seconds}s</p>
          {seconds >= 25 && (
            <button
              onClick={onBotFallback}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90"
            >Play vs Bot instead</button>
          )}
        </>
      )}

      <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
        <X className="h-3 w-3" /> Cancel
      </button>
    </div>
  );
};

export default CompeteSearching;
