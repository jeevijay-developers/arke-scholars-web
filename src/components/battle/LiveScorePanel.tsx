import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import type { PlayerScore } from "@/hooks/useBattleRoom";

type Props = {
  myScore: PlayerScore | null;
  opponentScore: PlayerScore | null;
  myName: string;
  myAvatar: string | null;
  opponentName: string;
  opponentAvatar: string | null;
  totalQuestions: number;
};

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-background"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted ring-2 ring-background">
      <User className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function PlayerPane({
  score,
  name,
  avatar,
  totalQuestions,
  highlight,
}: {
  score: PlayerScore | null;
  name: string;
  avatar: string | null;
  totalQuestions: number;
  highlight?: boolean;
}) {
  const answered = score?.questionsAnswered ?? 0;
  const pts = score?.score ?? 0;
  const progress = totalQuestions > 0 ? answered / totalQuestions : 0;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-xl border p-3",
        highlight && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar src={avatar} name={name} />
        <span className="text-sm font-semibold truncate max-w-[100px]">{name}</span>
      </div>

      <span className="text-2xl font-bold tabular-nums">{pts}</span>
      <span className="text-xs text-muted-foreground">pts</span>

      {/* Question progress bar */}
      <div className="w-full space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Q {answered}</span>
          <span>{totalQuestions}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function LiveScorePanel({
  myScore,
  opponentScore,
  myName,
  myAvatar,
  opponentName,
  opponentAvatar,
  totalQuestions,
}: Props) {
  return (
    <div className="flex items-stretch gap-3">
      <PlayerPane
        score={myScore}
        name={myName}
        avatar={myAvatar}
        totalQuestions={totalQuestions}
        highlight
      />

      <div className="flex items-center justify-center px-1">
        <span className="text-xs font-bold text-muted-foreground">VS</span>
      </div>

      <PlayerPane
        score={opponentScore}
        name={opponentName}
        avatar={opponentAvatar}
        totalQuestions={totalQuestions}
      />
    </div>
  );
}
