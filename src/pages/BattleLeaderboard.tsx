import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Medal, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBattleLeaderboard } from "@/hooks/useBattleLeaderboard";
import { SUBJECTS_COMPETE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CLASS_LEVELS = ["", "6", "7", "8", "9", "10", "11", "12", "12th pass"];

const RANK_BADGE: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export default function BattleLeaderboard() {
  const navigate = useNavigate();
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const { rows, loading, error } = useBattleLeaderboard(
    filterClass || undefined,
    filterSubject || undefined,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl font-bold">Battle Leaderboard</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Classes</SelectItem>
            {CLASS_LEVELS.filter(Boolean).map((c) => (
              <SelectItem key={c} value={c}>Class {c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Subjects</SelectItem>
            {SUBJECTS_COMPETE.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {loading ? "Loading…" : `${rows.length} players ranked`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading rankings…
            </div>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No completed battles yet for these filters.
            </p>
          )}

          {!loading && rows.length > 0 && (
            <div className="divide-y">
              {/* Header row */}
              <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_4rem_4rem] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>#</span>
                <span>Player</span>
                <span className="text-center">W</span>
                <span className="text-center">L</span>
                <span className="text-center">D</span>
                <span className="text-center">Battles</span>
                <span className="text-center">Win %</span>
              </div>

              {rows.map((row, idx) => {
                const rank = idx + 1;
                return (
                  <div
                    key={row.userId}
                    className={cn(
                      "grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_4rem_4rem] gap-2 items-center px-4 py-3 text-sm",
                      rank <= 3 && "bg-amber-50/50 dark:bg-amber-950/10",
                    )}
                  >
                    {/* Rank */}
                    <span className="font-bold text-muted-foreground">
                      {RANK_BADGE[rank] ?? rank}
                    </span>

                    {/* Player */}
                    <div className="flex items-center gap-2 min-w-0">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt={row.fullName} className="h-7 w-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {row.fullName[0]}
                        </div>
                      )}
                      <span className="truncate font-medium">{row.fullName}</span>
                      {rank === 1 && <Medal className="h-4 w-4 text-amber-500 shrink-0" />}
                    </div>

                    <span className="text-center font-semibold text-emerald-600">{row.wins}</span>
                    <span className="text-center text-red-500">{row.losses}</span>
                    <span className="text-center text-muted-foreground">{row.draws}</span>
                    <span className="text-center text-muted-foreground">{row.totalBattles}</span>
                    <span
                      className={cn(
                        "text-center font-semibold tabular-nums",
                        row.winRate >= 60 ? "text-emerald-600" : row.winRate >= 40 ? "text-amber-600" : "text-red-500",
                      )}
                    >
                      {row.winRate}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center">
        <Button onClick={() => navigate("/battle")} className="gap-2">
          Play a Battle
        </Button>
      </div>
    </div>
  );
}
