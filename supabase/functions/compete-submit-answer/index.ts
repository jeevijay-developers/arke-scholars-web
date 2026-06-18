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
const GEMINI_TIMEOUT_MS = 2_500;

async function askGeminiForBotAnswer(
  questionText: string,
  options: string[],
  correctIndex: number,
  difficulty: string,
  subject: string,
  botRating: number,
): Promise<number> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) throw new Error("No API key");

  const prompt =
    `You are simulating a competitive exam student with ELO rating ${botRating} (scale: 800–1800, average 1000, expert 1600+).
Subject: ${subject}. Difficulty: ${difficulty ?? "medium"}.

Question: ${questionText}
Options:
0) ${options[0] ?? ""}
1) ${options[1] ?? ""}
2) ${options[2] ?? ""}
3) ${options[3] ?? ""}

Higher rating → more likely to choose the correct answer.
Lower rating → may pick a plausible but wrong option.
Reply with ONLY a single digit: 0, 1, 2, or 3.`;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4, temperature: 0.2 },
        }),
      },
    );
    clearTimeout(tid);
    const json = await res.json();
    const raw = (json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    const parsed = parseInt(raw[0], 10);
    if ([0, 1, 2, 3].includes(parsed)) return parsed;
    // Gemini returned the right digit but in unexpected format — fall through
    throw new Error("unexpected response");
  } catch {
    clearTimeout(tid);
    // Fallback: rating-weighted random — hitRate scales 25%–85% across 800–1800
    const hitRate = Math.min(0.85, Math.max(0.25, (botRating - 800) / 1000));
    if (Math.random() < hitRate) return correctIndex;
    // Pick a plausible wrong option (any option except correct)
    const wrong = [0, 1, 2, 3].filter((i) => i !== correctIndex && i < options.length);
    return wrong[Math.floor(Math.random() * wrong.length)] ?? correctIndex;
  }
}

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
      const { data: q } = await sb.from("compete_questions")
        .select("correct_index, options, question_text, difficulty")
        .eq("id", qid).single();

      isCorrect = selectedIndex !== null && q?.correct_index === selectedIndex;
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

      if (isP1) {
        await sb.rpc("increment_player1_score", { match_id: matchId, delta: points });
        await sb.rpc("increment_player1_answers", { match_id: matchId });
      } else {
        await sb.rpc("increment_player2_score", { match_id: matchId, delta: points });
        await sb.rpc("increment_player2_answers", { match_id: matchId });
      }

      // Simulate bot answer using Gemini calibrated to user's rating
      if (match.is_bot && !match.player2_id) {
        const { data: botExisting } = await sb.from("compete_match_answers")
          .select("id").eq("match_id", matchId).eq("user_id", BOT_ID).eq("question_index", questionIndex).maybeSingle();

        if (!botExisting) {
          const opts = (q?.options as string[]) ?? [];
          const botRating: number = match.player2_rating_before ?? 1000;

          const botSel = await askGeminiForBotAnswer(
            q?.question_text ?? "",
            opts,
            q!.correct_index,
            q?.difficulty ?? "medium",
            match.subject ?? "Physics",
            botRating,
          );

          const botCorrect = botSel === q!.correct_index;
          // Realistic answer time: 3–20 s, skewed toward middle
          const botTime = 3000 + Math.floor(Math.random() * 17_000);
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
    }

    const totalQ = match.question_ids.length;

    const { data: snapshot } = await sb.from("compete_matches")
      .select("player1_answer_count, player2_answer_count")
      .eq("id", matchId)
      .single();

    const myCount = isP1 ? (snapshot?.player1_answer_count ?? 0) : (snapshot?.player2_answer_count ?? 0);
    const oppCount = isP1 ? (snapshot?.player2_answer_count ?? 0) : (snapshot?.player1_answer_count ?? 0);

    if (myCount >= totalQ && oppCount >= totalQ) {
      const { error: finalizeError } = await sb.rpc("finalize_match", { p_match_id: matchId });
      if (finalizeError) throw finalizeError;
    }

    return jsonResponse({ ok: true, is_correct: isCorrect, points });
  } catch (e) {
    console.error("submit error", e);
    return jsonResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
