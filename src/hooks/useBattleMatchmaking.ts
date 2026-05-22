import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BattleFilters = {
  classLevel: string;
  targetExam: string;
  subject: string;
  topic: string;
};

export type BattleMatchState =
  | { phase: "idle" }
  | { phase: "waiting"; battleId: string }
  | { phase: "active"; battleId: string }
  | { phase: "error"; message: string };

export function useBattleMatchmaking() {
  const [state, setState] = useState<BattleMatchState>({ phase: "idle" });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Subscribe to the battle row and watch for status changes
  const subscribeToBattle = useCallback(
    (battleId: string) => {
      cleanup();
      const channel = supabase
        .channel(`battle:${battleId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "battles",
            filter: `id=eq.${battleId}`,
          },
          (payload) => {
            const updated = payload.new as { status: string; question_ids: string[] };
            if (updated.status === "active" && updated.question_ids?.length > 0) {
              setState({ phase: "active", battleId });
            } else if (updated.status === "completed") {
              setState({ phase: "idle" });
            }
          },
        )
        .subscribe();

      channelRef.current = channel;
    },
    [cleanup],
  );

  const enterLobby = useCallback(
    async (filters: BattleFilters) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setState({ phase: "error", message: "Not logged in" });
        return;
      }

      setState({ phase: "waiting", battleId: "" }); // optimistic loading

      try {
        // Find open lobbies with matching filters (grab a few to handle races)
        const { data: candidates } = await supabase
          .from("battles")
          .select("id")
          .eq("status", "waiting")
          .eq("class_level", filters.classLevel)
          .eq("target_exam", filters.targetExam)
          .eq("subject", filters.subject)
          .eq("topic", filters.topic)
          .is("player2_id", null)
          .neq("player1_id", userId)
          .limit(5);

        // Try to atomically claim one (race-safe: only succeeds if player2_id is still null)
        for (const candidate of candidates ?? []) {
          const { data: claimed } = await supabase
            .from("battles")
            .update({ player2_id: userId, status: "active" })
            .eq("id", candidate.id)
            .is("player2_id", null) // atomic guard
            .select("id");

          if (claimed && claimed.length > 0) {
            const battleId = claimed[0].id as string;
            setState({ phase: "active", battleId });
            subscribeToBattle(battleId);

            // Player 2 triggers question selection for both players
            await supabase.functions.invoke("select-battle-questions", {
              body: { battleId },
            });

            // Re-fetch the battle to check if question_ids are now populated
            const { data: updatedBattle } = await supabase
              .from("battles")
              .select("question_ids")
              .eq("id", battleId)
              .single();

            if (!updatedBattle?.question_ids?.length) {
              setState({ phase: "error", message: "Failed to load questions for this battle" });
              return;
            }

            // Initialize score rows for both players
            const { data: battleFull } = await supabase
              .from("battles")
              .select("player1_id, player2_id")
              .eq("id", battleId)
              .single();

            if (battleFull) {
              await supabase.from("battle_scores").upsert([
                { battle_id: battleId, player_id: battleFull.player1_id, score: 0, questions_answered: 0 },
                { battle_id: battleId, player_id: userId, score: 0, questions_answered: 0 },
              ], { onConflict: "battle_id,player_id", ignoreDuplicates: true });
            }

            setState({ phase: "active", battleId });
            return;
          }
        }

        // No open lobby found — create one and wait
        const { data: newBattle, error: insertErr } = await supabase
          .from("battles")
          .insert({
            player1_id: userId,
            class_level: filters.classLevel,
            target_exam: filters.targetExam,
            subject: filters.subject,
            topic: filters.topic,
            status: "waiting",
          })
          .select("id")
          .single();

        if (insertErr || !newBattle) {
          setState({ phase: "error", message: insertErr?.message ?? "Failed to create lobby" });
          return;
        }

        const battleId = newBattle.id as string;
        setState({ phase: "waiting", battleId });
        subscribeToBattle(battleId);

        // Initialize score row for player 1
        await supabase.from("battle_scores").insert({
          battle_id: battleId,
          player_id: userId,
          score: 0,
          questions_answered: 0,
        });
      } catch (err) {
        setState({ phase: "error", message: (err as Error).message });
      }
    },
    [subscribeToBattle],
  );

  const cancelLobby = useCallback(async () => {
    if (state.phase === "waiting" && state.battleId) {
      await supabase.from("battles").delete().eq("id", state.battleId);
    }
    cleanup();
    setState({ phase: "idle" });
  }, [state, cleanup]);

  // On "active" we may need to wait for question_ids to appear (Player 1 path)
  useEffect(() => {
    if (state.phase !== "waiting" || !state.battleId) return;

    // Poll briefly for question_ids appearing after player2 joins
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("battles")
        .select("status, question_ids")
        .eq("id", state.battleId)
        .single();

      if (data?.status === "active" && data?.question_ids?.length > 0) {
        setState({ phase: "active", battleId: state.battleId });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => cleanup, [cleanup]);

  return { state, enterLobby, cancelLobby };
}
