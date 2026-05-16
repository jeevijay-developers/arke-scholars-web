import { admin, corsHeaders, getOrCreateRating, getProfileMini, getUser, jsonResponse, pickQuestionIds, randomBotName } from "../_shared/compete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "find"); // find | poll | cancel | bot
    const subject = String(body.subject || "Physics");
    const topic = String(body.topic || "Any");

    const sb = admin();
    const profile = await getProfileMini(sb, user.id);
    const exam = profile.target_exam || "general";
    const rating = await getOrCreateRating(sb, user.id, exam);

    if (action === "cancel") {
      await sb.from("compete_queue").delete().eq("user_id", user.id);
      return jsonResponse({ ok: true });
    }

    if (action === "bot") {
      // Force bot match
      await sb.from("compete_queue").delete().eq("user_id", user.id);
      const questionIds = await pickQuestionIds(sb, subject, topic, 10);
      const { data: match } = await sb.from("compete_matches").insert({
        player1_id: user.id,
        player2_id: null,
        player1_name: profile.full_name,
        player1_avatar: profile.avatar_url,
        player2_name: randomBotName(),
        player1_rating_before: rating.rating,
        player2_rating_before: 1000,
        subject, topic,
        question_ids: questionIds,
        total_questions: questionIds.length,
        status: "active",
        is_bot: true,
        started_at: new Date().toISOString(),
        countdown_until: new Date(Date.now() + 5000).toISOString(),
        current_question_started_at: new Date(Date.now() + 5000).toISOString(),
      }).select("*").single();
      return jsonResponse({ status: "matched", match_id: match!.id, is_bot: true });
    }

    if (action === "poll") {
      const { data: q } = await sb.from("compete_queue").select("match_id, status").eq("user_id", user.id).maybeSingle();
      if (q?.match_id) {
        await sb.from("compete_queue").delete().eq("user_id", user.id);
        return jsonResponse({ status: "matched", match_id: q.match_id });
      }
      return jsonResponse({ status: "waiting" });
    }

    // action === "find"
    // Insert/upsert our own queue row
    await sb.from("compete_queue").upsert({
      user_id: user.id,
      target_exam: exam,
      class_level: profile.class_level,
      subject, topic,
      rating: rating.rating,
      status: "waiting",
      match_id: null,
    }, { onConflict: "user_id" });

    // Search for an opponent (same exam, class, subject, topic, ±200 ELO)
    const { data: candidates } = await sb
      .from("compete_queue")
      .select("*")
      .eq("status", "waiting")
      .eq("subject", subject)
      .eq("topic", topic)
      .eq("target_exam", exam)
      .neq("user_id", user.id)
      .gte("rating", rating.rating - 200)
      .lte("rating", rating.rating + 200)
      .order("created_at", { ascending: true })
      .limit(5);

    let opponent = (candidates ?? []).find((c) => !profile.class_level || !c.class_level || c.class_level === profile.class_level);
    if (!opponent && candidates && candidates.length > 0) opponent = candidates[0];

    if (opponent) {
      // Atomically claim opponent row
      const { data: claimed } = await sb
        .from("compete_queue")
        .update({ status: "matched" })
        .eq("user_id", opponent.user_id)
        .eq("status", "waiting")
        .select("*")
        .maybeSingle();
      if (claimed) {
        const oppProfile = await getProfileMini(sb, opponent.user_id);
        const questionIds = await pickQuestionIds(sb, subject, topic, 10);
        const { data: match } = await sb.from("compete_matches").insert({
          player1_id: user.id,
          player2_id: opponent.user_id,
          player1_name: profile.full_name,
          player2_name: oppProfile.full_name,
          player1_avatar: profile.avatar_url,
          player2_avatar: oppProfile.avatar_url,
          player1_rating_before: rating.rating,
          player2_rating_before: opponent.rating,
          subject, topic,
          question_ids: questionIds,
          total_questions: questionIds.length,
          status: "active",
          started_at: new Date().toISOString(),
          countdown_until: new Date(Date.now() + 5000).toISOString(),
          current_question_started_at: new Date(Date.now() + 5000).toISOString(),
        }).select("*").single();
        // Notify opponent via their queue row
        await sb.from("compete_queue").update({ match_id: match!.id }).eq("user_id", opponent.user_id);
        // Remove my queue row
        await sb.from("compete_queue").delete().eq("user_id", user.id);
        return jsonResponse({ status: "matched", match_id: match!.id });
      }
    }

    return jsonResponse({ status: "waiting" });
  } catch (e) {
    console.error("matchmake error", e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
