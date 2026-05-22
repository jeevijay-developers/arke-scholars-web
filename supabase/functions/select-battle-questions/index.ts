import { admin, corsHeaders, getUser, jsonResponse, pickQuestionIds } from "../_shared/compete.ts";

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

    // If questions already selected (idempotent), just return them
    if (battle.question_ids && battle.question_ids.length > 0) {
      const { data: qs } = await sb
        .from("compete_questions")
        .select("id, question_text, options, difficulty, subject, topic, class_level, target_exam")
        .in("id", battle.question_ids);

      const byId = new Map((qs ?? []).map((q) => [q.id, q]));
      const ordered = battle.question_ids
        .map((id: string) => byId.get(id))
        .filter(Boolean);

      return jsonResponse({ questions: ordered });
    }

    // Pick 10 random questions for this battle's filters
    const questionIds = await pickQuestionIds(
      sb,
      battle.subject,
      [battle.topic],
      battle.class_level,
      battle.target_exam,
      10,
    );

    if (questionIds.length === 0) {
      return jsonResponse({ error: "No questions available for these filters" }, 422);
    }

    // Store question IDs on the battle row so both players get the same set
    await sb
      .from("battles")
      .update({ question_ids: questionIds })
      .eq("id", battleId);

    const { data: qs } = await sb
      .from("compete_questions")
      .select("id, question_text, options, difficulty, subject, topic, class_level, target_exam")
      .in("id", questionIds);

    const byId = new Map((qs ?? []).map((q) => [q.id, q]));
    const ordered = questionIds
      .map((id) => byId.get(id))
      .filter(Boolean);

    return jsonResponse({ questions: ordered });
  } catch (e) {
    console.error("select-battle-questions error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
