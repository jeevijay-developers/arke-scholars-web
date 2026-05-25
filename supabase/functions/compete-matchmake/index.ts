import { admin, corsHeaders, getOrCreateRating, getProfileMini, getUser, jsonResponse, pickQuestionIds, randomBotName } from "../_shared/compete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "find"); // find | poll | cancel | bot
    const subject = String(body.subject || "Physics");
    const topics: string[] = Array.isArray(body.topics) ? body.topics : [];
    const classLevel = String(body.classLevel || "11");
    const targetExam = String(body.targetExam || "JEE Main");

    const sb = admin();
    const profile = await getProfileMini(sb, user.id);
    const exam = profile.target_exam || "general";
    const rating = await getOrCreateRating(sb, user.id, exam);

    if (action === "cancel") {
      await sb.from("compete_queue").delete().eq("user_id", user.id);
      return jsonResponse({ ok: true });
    }

    if (action === "bot") {
      await sb.from("compete_queue").delete().eq("user_id", user.id);
      const questionIds = await pickQuestionIds(sb, subject, topics, classLevel, targetExam, 10);
      const { data: match } = await sb.from("compete_matches").insert({
        player1_id: user.id,
        player2_id: null,
        player1_name: profile.full_name,
        player1_avatar: profile.avatar_url,
        player2_name: randomBotName(),
        player1_rating_before: rating.rating,
        player2_rating_before: 1000,
        subject, topic: topics.length > 0 ? topics.join(", ") : "Any",
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
      const { data: q } = await sb.from("compete_queue").select("*").eq("user_id", user.id).maybeSingle();
      if (!q) return jsonResponse({ status: "waiting" });

      // Already matched by the opponent's "find" call
      if (q.match_id) {
        await sb.from("compete_queue").delete().eq("user_id", user.id);
        return jsonResponse({ status: "matched", match_id: q.match_id });
      }

      // Still waiting — re-attempt matching so simultaneous "find" race conditions resolve within one poll cycle
      const qSubject = q.subject || "Physics";
      const qExam = q.target_exam || "JEE Main";
      const qClass = q.class_level || "11";
      const qTopics: string[] = Array.isArray(q.topics) ? q.topics : [];
      const waitingCutoff = new Date(Date.now() - 20000).toISOString();

      const { data: same } = await sb.from("compete_queue").select("*").eq("status", "waiting").eq("subject", qSubject).eq("target_exam", qExam).eq("class_level", qClass).neq("user_id", user.id).gte("rating", q.rating - 200).lte("rating", q.rating + 200).order("created_at", { ascending: true }).limit(5);
      const { data: any } = await sb.from("compete_queue").select("*").eq("status", "waiting").eq("subject", qSubject).eq("target_exam", qExam).neq("user_id", user.id).lte("created_at", waitingCutoff).gte("rating", q.rating - 200).lte("rating", q.rating + 200).order("created_at", { ascending: true }).limit(5);
      const candidates = [...(same ?? []), ...(any ?? []).filter((c: any) => !(same ?? []).some((s: any) => s.user_id === c.user_id))];
      const opponent = candidates[0] ?? null;

      if (opponent) {
        const { data: claimed } = await sb.from("compete_queue").update({ status: "matched" }).eq("user_id", opponent.user_id).eq("status", "waiting").select("*").maybeSingle();
        if (claimed) {
          const [oppProfile, pollProfile] = await Promise.all([getProfileMini(sb, opponent.user_id), getProfileMini(sb, user.id)]);
          const questionIds = await pickQuestionIds(sb, qSubject, qTopics, qClass, qExam, 10);
          const { data: match } = await sb.from("compete_matches").insert({
            player1_id: user.id, player2_id: opponent.user_id,
            player1_name: pollProfile.full_name, player2_name: oppProfile.full_name,
            player1_avatar: pollProfile.avatar_url, player2_avatar: oppProfile.avatar_url,
            player1_rating_before: q.rating, player2_rating_before: opponent.rating,
            subject: qSubject, topic: qTopics.length > 0 ? qTopics.join(", ") : "Any",
            question_ids: questionIds, total_questions: questionIds.length,
            status: "active", started_at: new Date().toISOString(),
            countdown_until: new Date(Date.now() + 5000).toISOString(),
            current_question_started_at: new Date(Date.now() + 5000).toISOString(),
          }).select("*").single();
          await sb.from("compete_queue").update({ match_id: match!.id }).eq("user_id", opponent.user_id);
          await sb.from("compete_queue").delete().eq("user_id", user.id);
          return jsonResponse({ status: "matched", match_id: match!.id });
        }
      }

      return jsonResponse({ status: "waiting" });
    }

    // action === "find"
    await sb.from("compete_queue").upsert({
      user_id: user.id,
      target_exam: targetExam,
      class_level: classLevel,
      subject,
      topic: topics.length > 0 ? topics[0] : "Any",
      topics: topics,
      rating: rating.rating,
      status: "waiting",
      match_id: null,
    }, { onConflict: "user_id" });

    // Search: same exam + subject, rating ±200
    // Prefer same class_level; fall back to any if opponent has been waiting >20s
    const waitingCutoff = new Date(Date.now() - 20000).toISOString();

    const { data: sameLevelCandidates } = await sb
      .from("compete_queue")
      .select("*")
      .eq("status", "waiting")
      .eq("subject", subject)
      .eq("target_exam", targetExam)
      .eq("class_level", classLevel)
      .neq("user_id", user.id)
      .gte("rating", rating.rating - 200)
      .lte("rating", rating.rating + 200)
      .order("created_at", { ascending: true })
      .limit(5);

    const { data: anyLevelCandidates } = await sb
      .from("compete_queue")
      .select("*")
      .eq("status", "waiting")
      .eq("subject", subject)
      .eq("target_exam", targetExam)
      .neq("user_id", user.id)
      .lte("created_at", waitingCutoff)  // been waiting >20s
      .gte("rating", rating.rating - 200)
      .lte("rating", rating.rating + 200)
      .order("created_at", { ascending: true })
      .limit(5);

    const candidates = [
      ...(sameLevelCandidates ?? []),
      ...(anyLevelCandidates ?? []).filter((c: any) =>
        !(sameLevelCandidates ?? []).some((s: any) => s.user_id === c.user_id)
      ),
    ];

    const opponent = candidates[0] ?? null;

    if (opponent) {
      const { data: claimed } = await sb
        .from("compete_queue")
        .update({ status: "matched" })
        .eq("user_id", opponent.user_id)
        .eq("status", "waiting")
        .select("*")
        .maybeSingle();

      if (claimed) {
        const oppProfile = await getProfileMini(sb, opponent.user_id);
        // Use the initiator's topics + class/exam for question picking
        const questionIds = await pickQuestionIds(sb, subject, topics, classLevel, targetExam, 10);
        const { data: match } = await sb.from("compete_matches").insert({
          player1_id: user.id,
          player2_id: opponent.user_id,
          player1_name: profile.full_name,
          player2_name: oppProfile.full_name,
          player1_avatar: profile.avatar_url,
          player2_avatar: oppProfile.avatar_url,
          player1_rating_before: rating.rating,
          player2_rating_before: opponent.rating,
          subject,
          topic: topics.length > 0 ? topics.join(", ") : "Any",
          question_ids: questionIds,
          total_questions: questionIds.length,
          status: "active",
          started_at: new Date().toISOString(),
          countdown_until: new Date(Date.now() + 5000).toISOString(),
          current_question_started_at: new Date(Date.now() + 5000).toISOString(),
        }).select("*").single();
        await sb.from("compete_queue").update({ match_id: match!.id }).eq("user_id", opponent.user_id);
        await sb.from("compete_queue").delete().eq("user_id", user.id);
        return jsonResponse({ status: "matched", match_id: match!.id });
      }
    }

    return jsonResponse({ status: "waiting" });
  } catch (e) {
    console.error("matchmake error", e);
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
