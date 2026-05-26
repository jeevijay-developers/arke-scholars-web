import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data } = await sb.auth.getUser();
  return data.user;
}

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

    const { data: existing } = await sb.from("compete_match_answers")
      .select("id").eq("match_id", matchId).eq("user_id", user.id).eq("question_index", questionIndex).maybeSingle();

    const isP1 = user.id === match.player1_id;
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

      // Atomic score + answer count increment
      if (isP1) {
        await sb.rpc("increment_player1_score", { match_id: matchId, delta: points });
        await sb.rpc("increment_player1_answers", { match_id: matchId });
      } else {
        await sb.rpc("increment_player2_score", { match_id: matchId, delta: points });
        await sb.rpc("increment_player2_answers", { match_id: matchId });
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
        await sb.rpc("increment_player2_answers", { match_id: matchId });
      }
    }

    const totalQ = match.question_ids.length;

    // Re-fetch match to get the atomically-incremented answer counts.
    // Using match-level counts (rather than counting compete_match_answers) avoids
    // a race condition where concurrent fire-and-forget calls haven't all committed
    // their INSERTs yet when this COUNT query runs.
    const { data: snapshot } = await sb.from("compete_matches")
      .select("player1_answer_count, player2_answer_count")
      .eq("id", matchId)
      .single();

    const myCount = isP1 ? (snapshot?.player1_answer_count ?? 0) : (snapshot?.player2_answer_count ?? 0);
    const oppCount = isP1 ? (snapshot?.player2_answer_count ?? 0) : (snapshot?.player1_answer_count ?? 0);
    const canFinalize = myCount >= totalQ && oppCount >= totalQ;

    if (canFinalize) {
      // All ELO, streak, and match-status writes happen inside a single Postgres
      // transaction. FOR UPDATE in finalize_match() serialises concurrent calls —
      // the second caller waits, then sees status != 'active' and returns early.
      const { error: finalizeError } = await sb.rpc("finalize_match", { p_match_id: matchId });
      if (finalizeError) throw finalizeError;
    }

    return jsonResponse({ ok: true, is_correct: isCorrect, points });
  } catch (e) {
    console.error("submit error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
