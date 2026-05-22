import { admin, corsHeaders, determineWinner, getUser, jsonResponse } from "../_shared/compete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const battleId = String(body.battleId || "");
    if (!battleId) return jsonResponse({ error: "battleId required" }, 400);

    const sb = admin();

    const { data: battle } = await sb
      .from("battles")
      .select("*")
      .eq("id", battleId)
      .maybeSingle();

    if (!battle) return jsonResponse({ error: "Battle not found" }, 404);
    if (user.id !== battle.player1_id && user.id !== battle.player2_id) {
      return jsonResponse({ error: "Not a participant" }, 403);
    }
    if (battle.status !== "active") {
      // Already completed — return the current result
      return jsonResponse({ completed: battle.status === "completed", alreadyDone: true });
    }

    const totalQuestions = battle.question_ids?.length ?? 0;

    // Fetch both players' scores
    const { data: scores } = await sb
      .from("battle_scores")
      .select("player_id, score, questions_answered")
      .eq("battle_id", battleId);

    const p1Score = scores?.find((s: { player_id: string }) => s.player_id === battle.player1_id);
    const p2Score = scores?.find((s: { player_id: string }) => s.player_id === battle.player2_id);

    const p1Done = (p1Score?.questions_answered ?? 0) >= totalQuestions;
    const p2Done = (p2Score?.questions_answered ?? 0) >= totalQuestions;

    if (!p1Done || !p2Done) {
      // Other player hasn't finished yet
      return jsonResponse({ completed: false });
    }

    // Both finished — determine winner and close the battle
    const winnerId = determineWinner(
      p1Score?.score ?? 0,
      p2Score?.score ?? 0,
      battle.player1_id,
      battle.player2_id,
    );

    await sb
      .from("battles")
      .update({
        status: "completed",
        winner_id: winnerId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", battleId)
      .eq("status", "active"); // guard against double-completion

    return jsonResponse({ completed: true, winnerId });
  } catch (e) {
    console.error("complete-battle error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
