import { admin, corsHeaders, determineWinner, eloDelta, getUser, jsonResponse } from "../_shared/compete.ts";

const QUESTION_TIME_MS = 30_000;
const BOT_ID = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || "");
    const questionIndex = Number(body.question_index ?? -1);
    const selectedIndex = body.selected_index === null || body.selected_index === undefined ? null : Number(body.selected_index);
    const timeMs = Math.max(0, Math.min(QUESTION_TIME_MS, Number(body.time_taken_ms ?? QUESTION_TIME_MS)));

    if (!matchId || questionIndex < 0) return jsonResponse({ error: "Bad input" }, 400);

    const sb = admin();
    const { data: match } = await sb.from("compete_matches").select("*").eq("id", matchId).maybeSingle();
    if (!match) return jsonResponse({ error: "Match not found" }, 404);
    if (match.status !== "active") return jsonResponse({ error: "Match not active" }, 400);
    if (user.id !== match.player1_id && user.id !== match.player2_id) return jsonResponse({ error: "Not a participant" }, 403);

    const qid = match.question_ids[questionIndex];
    if (!qid) return jsonResponse({ error: "Invalid question index" }, 400);

    // Already answered? idempotent
    const { data: existing } = await sb.from("compete_match_answers")
      .select("id").eq("match_id", matchId).eq("user_id", user.id).eq("question_index", questionIndex).maybeSingle();

    let isCorrect = false;
    let points = 0;

    if (!existing) {
      const { data: q } = await sb.from("compete_questions").select("correct_index").eq("id", qid).single();
      isCorrect = selectedIndex !== null && q?.correct_index === selectedIndex;
      // Speed bonus: 100 base + up to 100 for speed (max 200), 0 if wrong
      const speedBonus = Math.max(0, 100 - Math.round((timeMs / QUESTION_TIME_MS) * 100));
      points = isCorrect ? 100 + speedBonus : 0;

      await sb.from("compete_match_answers").insert({
        match_id: matchId,
        user_id: user.id,
        question_index: questionIndex,
        question_id: qid,
        selected_index: selectedIndex,
        is_correct: isCorrect,
        time_taken_ms: timeMs,
        points,
      });

      // Atomic score increment
      const isP1 = user.id === match.player1_id;
      if (isP1) {
        await sb.rpc("increment_player1_score", { match_id: matchId, delta: points });
      } else {
        await sb.rpc("increment_player2_score", { match_id: matchId, delta: points });
      }
    }

    // For bot matches, simulate bot answer for this question
    if (match.is_bot && !match.player2_id) {
      const { data: botExisting } = await sb.from("compete_match_answers")
        .select("id").eq("match_id", matchId).eq("user_id", BOT_ID).eq("question_index", questionIndex).maybeSingle();
      if (!botExisting) {
        const { data: q } = await sb.from("compete_questions").select("correct_index, options").eq("id", qid).single();
        const opts = (q?.options as unknown[]) ?? [];
        const botCorrect = Math.random() < 0.65;
        const botSel = botCorrect ? q!.correct_index : Math.floor(Math.random() * Math.max(1, opts.length));
        const botTime = 4000 + Math.floor(Math.random() * 18000);
        const botSpeed = Math.max(0, 100 - Math.round((botTime / QUESTION_TIME_MS) * 100));
        const botPoints = botCorrect ? 100 + botSpeed : 0;
        await sb.from("compete_match_answers").insert({
          match_id: matchId,
          user_id: BOT_ID,
          question_index: questionIndex,
          question_id: qid,
          selected_index: botSel,
          is_correct: botCorrect,
          time_taken_ms: botTime,
          points: botPoints,
        });
        await sb.rpc("increment_player2_score", { match_id: matchId, delta: botPoints });
      }
    }

    const totalQ = match.question_ids.length;

    // Check if this player has now answered all questions
    const { count: myAnswerCount } = await sb.from("compete_match_answers")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("user_id", user.id);

    // Check if both players have answered all questions → finalize
    const opponentId = match.is_bot ? BOT_ID : (user.id === match.player1_id ? match.player2_id : match.player1_id);

    let canFinalize = false;
    if ((myAnswerCount ?? 0) >= totalQ) {
      if (!opponentId) {
        // Solo match (shouldn't happen normally)
        canFinalize = true;
      } else {
        const { count: oppAnswerCount } = await sb.from("compete_match_answers")
          .select("id", { count: "exact", head: true })
          .eq("match_id", matchId)
          .eq("user_id", opponentId);
        canFinalize = (oppAnswerCount ?? 0) >= totalQ;
      }
    }

    if (canFinalize) {
      // Re-fetch for fresh scores before finalizing
      const { data: finalMatch } = await sb.from("compete_matches").select("*").eq("id", matchId).single();
      if (finalMatch && finalMatch.status === "active") {
        const p1 = Number(finalMatch.player1_score);
        const p2 = Number(finalMatch.player2_score);
        const winnerId = determineWinner(p1, p2, finalMatch.player1_id, finalMatch.player2_id);

        let p1After = finalMatch.player1_rating_before;
        let p2After = finalMatch.player2_rating_before;

        if (!finalMatch.is_bot && finalMatch.player2_id) {
          const p1Score = winnerId === null ? 0.5 : (winnerId === finalMatch.player1_id ? 1 : 0);
          const p2Score = 1 - p1Score;
          const d1 = eloDelta(finalMatch.player1_rating_before, finalMatch.player2_rating_before, p1Score);
          const d2 = eloDelta(finalMatch.player2_rating_before, finalMatch.player1_rating_before, p2Score);
          p1After = finalMatch.player1_rating_before + d1;
          p2After = finalMatch.player2_rating_before + d2;

          for (const [uid, after, win, loss, draw] of [
            [finalMatch.player1_id, p1After, p1Score === 1 ? 1 : 0, p1Score === 0 ? 1 : 0, p1Score === 0.5 ? 1 : 0],
            [finalMatch.player2_id, p2After, p2Score === 1 ? 1 : 0, p2Score === 0 ? 1 : 0, p2Score === 0.5 ? 1 : 0],
          ] as const) {
            const { data: cur } = await sb.from("compete_ratings").select("*").eq("user_id", uid as string).maybeSingle();
            if (cur) {
              const newStreak = (win as number) === 1 ? cur.current_streak + 1 : 0;
              await sb.from("compete_ratings").update({
                rating: after,
                wins: cur.wins + (win as number),
                losses: cur.losses + (loss as number),
                draws: cur.draws + (draw as number),
                current_streak: newStreak,
                best_streak: Math.max(cur.best_streak, newStreak),
              }).eq("id", cur.id);
            }
          }
        }

        await sb.from("compete_matches").update({
          status: "finished",
          finished_at: new Date().toISOString(),
          winner_id: winnerId,
          player1_rating_after: p1After,
          player2_rating_after: p2After,
        }).eq("id", matchId);
      }
    }

    return jsonResponse({ ok: true, is_correct: isCorrect, points });
  } catch (e) {
    console.error("submit error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
