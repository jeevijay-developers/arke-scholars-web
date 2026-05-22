import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeaderboardRow = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  winRate: number;
};

export function useBattleLeaderboard(filterClass?: string, filterSubject?: string) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Build query for completed battles
        let q = supabase
          .from("battles")
          .select("player1_id, player2_id, winner_id, class_level, subject")
          .eq("status", "completed");

        if (filterClass) q = q.eq("class_level", filterClass);
        if (filterSubject) q = q.eq("subject", filterSubject);

        const { data: battles, error: bErr } = await q.limit(2000);
        if (bErr) throw new Error(bErr.message);
        if (cancelled) return;

        // Aggregate stats per user
        const stats = new Map<
          string,
          { wins: number; losses: number; draws: number }
        >();

        const touch = (uid: string) => {
          if (!stats.has(uid)) stats.set(uid, { wins: 0, losses: 0, draws: 0 });
          return stats.get(uid)!;
        };

        for (const b of battles ?? []) {
          const p1 = b.player1_id as string;
          const p2 = b.player2_id as string | null;
          const winner = b.winner_id as string | null;

          if (!p2) continue; // incomplete / bot match

          if (winner === null) {
            // Draw
            touch(p1).draws += 1;
            touch(p2).draws += 1;
          } else if (winner === p1) {
            touch(p1).wins += 1;
            touch(p2).losses += 1;
          } else {
            touch(p1).losses += 1;
            touch(p2).wins += 1;
          }
        }

        if (stats.size === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        // Fetch profiles for all users
        const userIds = Array.from(stats.keys());
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);

        if (cancelled) return;

        const profileMap = new Map(
          (profiles ?? []).map((p: { user_id: string; full_name: string; avatar_url: string | null }) => [
            p.user_id,
            p,
          ]),
        );

        const result: LeaderboardRow[] = userIds.map((uid) => {
          const s = stats.get(uid)!;
          const p = profileMap.get(uid);
          const totalBattles = s.wins + s.losses + s.draws;
          return {
            userId: uid,
            fullName: p?.full_name ?? "Unknown Player",
            avatarUrl: p?.avatar_url ?? null,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            totalBattles,
            winRate: totalBattles > 0 ? Math.round((s.wins / totalBattles) * 100) : 0,
          };
        });

        // Sort by wins desc, then win rate desc
        result.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

        setRows(result);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filterClass, filterSubject]);

  return { rows, loading, error };
}
