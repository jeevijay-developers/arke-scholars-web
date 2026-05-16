import { admin, corsHeaders, getOrCreateRating, getProfileMini, getUser, jsonResponse, pickQuestionIds, randomCode } from "../_shared/compete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject || "Physics");
    const topic = String(body.topic || "Any");

    const sb = admin();
    const profile = await getProfileMini(sb, user.id);
    const rating = await getOrCreateRating(sb, user.id, profile.target_exam || "general");
    const questionIds = await pickQuestionIds(sb, subject, topic, 10);

    let code = randomCode(6);
    // ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await sb.from("compete_matches").select("id").eq("room_code", code).maybeSingle();
      if (!exists) break;
      code = randomCode(6);
    }

    const { data: match, error } = await sb.from("compete_matches").insert({
      player1_id: user.id,
      player1_name: profile.full_name,
      player1_avatar: profile.avatar_url,
      player1_rating_before: rating.rating,
      subject, topic,
      question_ids: questionIds,
      total_questions: questionIds.length,
      status: "pending",
      room_code: code,
      is_private: true,
    }).select("*").single();

    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ match_id: match.id, room_code: code });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
