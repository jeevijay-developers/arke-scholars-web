import { useEffect, useState } from "react";
import { Crown, Swords } from "lucide-react";
import { CompeteMatch } from "@/hooks/useCompeteMatch";
import { useAuth } from "@/context/AuthContext";

type Props = { match: CompeteMatch };

const CompeteCountdown = ({ match }: Props) => {
  const { user } = useAuth();
  const isP1 = user?.id === match.player1_id;
  const myName = isP1 ? match.player1_name : match.player2_name;
  const oppName = isP1
    ? (match.player2_name || (match.is_bot ? "Bot" : "Opponent"))
    : match.player1_name;
  const target = match.countdown_until ? new Date(match.countdown_until).getTime() : Date.now();
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((target - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="text-center space-y-6 py-8 animate-fade-in-up">
      <div className="inline-flex items-center gap-2 rounded-full bg-secondary/20 border border-secondary/30 px-3 py-1 text-xs font-bold text-secondary">
        <Crown className="h-3 w-3" /> Match Found
      </div>
      <div className="grid grid-cols-3 items-center max-w-md mx-auto gap-2">
        <Avatar name={myName ?? "You"} ready me />
        <Swords className="h-8 w-8 text-accent mx-auto animate-pulse" />
        <Avatar name={oppName ?? "Opponent"} ready />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-white/50 font-bold">Starts in</p>
        <p className="text-7xl font-black text-white font-display leading-none mt-2">{left || "GO!"}</p>
      </div>
      <p className="text-xs text-white/60">
        {match.subject} · {match.topic} · {match.total_questions} questions · 30s each
      </p>
    </div>
  );
};

const Avatar = ({ name, ready, me }: { name: string; ready: boolean; me?: boolean }) => {
  const initials = (name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="text-center">
      <div className={`h-16 w-16 mx-auto rounded-full bg-gradient-to-br ${me ? "from-primary to-accent" : "from-secondary to-primary"} border-2 ${ready ? "border-secondary" : "border-white/20"} flex items-center justify-center`}>
        <span className="text-base font-black text-white">{initials}</span>
      </div>
      <p className="text-xs font-bold text-white mt-2 truncate">{name}</p>
      <p className={`text-[10px] font-bold mt-0.5 ${ready ? "text-secondary" : "text-white/40"}`}>{ready ? "READY" : "Connecting..."}</p>
    </div>
  );
};

export default CompeteCountdown;
