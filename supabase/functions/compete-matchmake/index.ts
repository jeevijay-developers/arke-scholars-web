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

    // ---------------------------------------------------------------------------
    // Helper: attempt to atomically claim an opponent using the DB function.
    // Returns the match_id if a new match was created, or a pre-existing match_id
    // if we were claimed by the opponent first, or null if no match could be made.
    // ---------------------------------------------------------------------------
    const attemptClaim = async (
      opponentRow: Record<string, any>,
      p1Subject: string,
      p1Topics: string[],
      p1ClassLevel: string,
      p1TargetExam: string,
      p1Rating: number,
      p1Profile: { full_name: string | null; avatar_url: string | null },
    ): Promise<string | null> => {
      // Atomic claim via DB function (SELECT FOR UPDATE, consistent UUID ordering)
      const { data: claimed } = await sb.rpc("try_claim_opponent", {
        p_my_id: user.id,
        p_opp_id: opponentRow.user_id,
      });

      if (!claimed) {
        // We lost the race — check if the opponent already matched us instead
        const { data: myEntry } = await sb.from("compete_queue")
          .select("match_id, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (myEntry?.match_id) {
          // Opponent created a match for us — clean up our queue entry and return it
          await sb.from("compete_queue").delete().eq("user_id", user.id);
          return myEntry.match_id as string;
        }
        return null;
      }

      // We won the claim — create the match
      const oppProfile = await getProfileMini(sb, opponentRow.user_id);
      const questionIds = await pickQuestionIds(sb, p1Subject, p1Topics, p1ClassLevel, p1TargetExam, 10);
      const { data: match } = await sb.from("compete_matches").insert({
        player1_id: user.id,
        player2_id: opponentRow.user_id,
        player1_name: p1Profile.full_name,
        player2_name: oppProfile.full_name,
        player1_avatar: p1Profile.avatar_url,
        player2_avatar: oppProfile.avatar_url,
        player1_rating_before: p1Rating,
        player2_rating_before: opponentRow.rating,
        subject: p1Subject,
        topic: p1Topics.length > 0 ? p1Topics.join(", ") : "Any",
        question_ids: questionIds,
        total_questions: questionIds.length,
        status: "active",
        started_at: new Date().toISOString(),
        countdown_until: new Date(Date.now() + 5000).toISOString(),
        current_question_started_at: new Date(Date.now() + 5000).toISOString(),
      }).select("*").single();
      // Set match_id on the opponent's queue entry so their next poll finds it
      await sb.from("compete_queue").update({ match_id: match!.id }).eq("user_id", opponentRow.user_id);
      // (We were already removed from queue by try_claim_opponent)
      return match!.id as string;
    };

    // ---------------------------------------------------------------------------
    // POLL action
    // ---------------------------------------------------------------------------
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
        const pollProfile = await getProfileMini(sb, user.id);
        const matchId = await attemptClaim(opponent, qSubject, qTopics, qClass, qExam, q.rating, pollProfile);
        if (matchId) return jsonResponse({ status: "matched", match_id: matchId });
      }

      return jsonResponse({ status: "waiting" });
    }

    // ---------------------------------------------------------------------------
    // FIND action
    // ---------------------------------------------------------------------------
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
    // Prefer same class_level; fall back to any class if opponent has been waiting >20s
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
      .lte("created_at", waitingCutoff)
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
      const matchId = await attemptClaim(opponent, subject, topics, classLevel, targetExam, rating.rating, profile);
      if (matchId) return jsonResponse({ status: "matched", match_id: matchId });
    }

    return jsonResponse({ status: "waiting" });
  } catch (e) {
    console.error("matchmake error", e);
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
