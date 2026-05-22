import { admin, corsHeaders, getUser, jsonResponse } from "../_shared/compete.ts";

const MAX_SECONDS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const battleId = String(body.battleId || "");
    const questionId = String(body.questionId || "");
    const selectedOptionIndex =
      body.selectedOptionIndex === null || body.selectedOptionIndex === undefined
        ? null
        : Number(body.selectedOptionIndex);
    // Cap seconds_taken at 30 (client is trusted for self-reported timing)
    const secondsTaken = Math.max(0, Math.min(MAX_SECONDS, Number(body.secondsTaken ?? MAX_SECONDS)));

    if (!battleId || !questionId) return jsonResponse({ error: "battleId and questionId required" }, 400);

    const sb = admin();

    const { data: battle } = await sb
      .from("battles")
      .select("id, player1_id, player2_id, status, question_ids")
      .eq("id", battleId)
      .maybeSingle();

    if (!battle) return jsonResponse({ error: "Battle not found" }, 404);
    if (battle.status !== "active") return jsonResponse({ error: "Battle not active" }, 400);
    if (user.id !== battle.player1_id && user.id !== battle.player2_id) {
      return jsonResponse({ error: "Not a participant" }, 403);
    }
    if (!battle.question_ids.includes(questionId)) {
      return jsonResponse({ error: "Question not part of this battle" }, 400);
    }

    // Idempotency guard
    const { data: existing } = await sb
      .from("battle_answers")
      .select("id, is_correct, points_earned")
      .eq("battle_id", battleId)
      .eq("player_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existing) {
      // Already answered — return cached result
      const { data: cq } = await sb
        .from("compete_questions")
        .select("correct_index")
        .eq("id", questionId)
        .single();
      return jsonResponse({
        isCorrect: existing.is_correct,
        pointsEarned: existing.points_earned,
        correctOptionIndex: cq?.correct_index ?? null,
      });
    }

    // Server-side answer validation — never expose correct_index to client before this point
    const { data: question } = await sb
      .from("compete_questions")
      .select("correct_index")
      .eq("id", questionId)
      .single();

    if (!question) return jsonResponse({ error: "Question not found" }, 404);

    const isCorrect = selectedOptionIndex !== null && question.correct_index === selectedOptionIndex;
    // Scoring: 100 base + floor(30 - secondsTaken) * 2 speed bonus (max +58 for instant answer)
    const speedBonus = isCorrect ? Math.floor(MAX_SECONDS - secondsTaken) * 2 : 0;
    const pointsEarned = isCorrect ? 100 + speedBonus : 0;

    // Insert answer record
    await sb.from("battle_answers").insert({
      battle_id: battleId,
      player_id: user.id,
      question_id: questionId,
      selected_option_index: selectedOptionIndex,
      is_correct: isCorrect,
      seconds_taken: secondsTaken,
      points_earned: pointsEarned,
    });

    // Upsert running score (triggers Realtime for opponent)
    const { data: existingScore } = await sb
      .from("battle_scores")
      .select("score, questions_answered")
      .eq("battle_id", battleId)
      .eq("player_id", user.id)
      .maybeSingle();

    if (existingScore) {
      await sb
        .from("battle_scores")
        .update({
          score: existingScore.score + pointsEarned,
          questions_answered: existingScore.questions_answered + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("battle_id", battleId)
        .eq("player_id", user.id);
    } else {
      await sb.from("battle_scores").insert({
        battle_id: battleId,
        player_id: user.id,
        score: pointsEarned,
        questions_answered: 1,
      });
    }

    return jsonResponse({
      isCorrect,
      pointsEarned,
      correctOptionIndex: question.correct_index,
    });
  } catch (e) {
    console.error("submit-battle-answer error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
