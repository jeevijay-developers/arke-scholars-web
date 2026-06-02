import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CompeteQueueEntry = {
  user_id: string;
  subject: string;
  target_exam: string;
  class_level: string;
  topics: string[];
  rating: number;
  status: string;
  match_id: string | null;
  created_at: string;
};

type CompeteRating = {
  id: string;
  user_id: string;
  target_exam: string;
  rating: number;
};

type ProfileMini = {
  full_name: string | null;
  avatar_url: string | null;
  target_exam: string | null;
  class_level: string | null;
};

type CompeteMatch = {
  id: string;
  [key: string]: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await sb.auth.getUser();
  return data.user;
}

async function getOrCreateRating(sb: ReturnType<typeof admin>, userId: string, exam: string): Promise<CompeteRating> {
  const { data } = await sb.from("compete_ratings").select("*").eq("user_id", userId).eq("target_exam", exam).maybeSingle();
  if (data) return data as CompeteRating;
  const { data: created } = await sb.from("compete_ratings").insert({ user_id: userId, target_exam: exam }).select("*").single();
  return created as CompeteRating;
}

async function getProfileMini(sb: ReturnType<typeof admin>, userId: string): Promise<ProfileMini> {
  const { data } = await sb.from("profiles").select("full_name, avatar_url, target_exam, class_level").eq("user_id", userId).maybeSingle();
  return (data as ProfileMini) ?? { full_name: "Player", avatar_url: null, target_exam: "general", class_level: null };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function pickQuestionIds(sb: ReturnType<typeof admin>, subject: string, topics: string[], classLevel: string, targetExam: string, count = 10): Promise<string[]> {
  const activTopics = topics.filter((t) => t && t !== "Any");
  const fetchPool = async (topicFilter: string | null, useClassExam: boolean): Promise<string[]> => {
    let q = sb.from("compete_questions").select("id").eq("is_active", true).eq("subject", subject);
    if (topicFilter) q = q.eq("topic", topicFilter);
    if (useClassExam) q = q.eq("class_level", classLevel).eq("target_exam", targetExam);
    const { data } = await q.limit(60);
    return (data ?? []).map((r) => r.id as string);
  };
  let pool: string[] = [];
  if (activTopics.length > 0) {
    const perTopic = Math.ceil(count / activTopics.length);
    for (const t of activTopics) {
      let ids = await fetchPool(t, true);
      if (ids.length === 0) ids = await fetchPool(t, false);
      pool.push(...shuffle(ids).slice(0, perTopic));
    }
  } else {
    pool = await fetchPool(null, true);
    if (pool.length < count) pool = await fetchPool(null, false);
  }
  pool = shuffle([...new Set(pool)]);
  if (pool.length < count) {
    const { data: d3 } = await sb.from("compete_questions").select("id").eq("is_active", true).limit(60);
    const extra = (d3 ?? []).map((r) => r.id as string).filter((id) => !pool.includes(id));
    pool.push(...shuffle(extra));
  }
  return pool.slice(0, count);
}

const INDIAN_FIRST_NAMES = ["Aarav","Arjun","Rohan","Vikram","Karan","Amit","Rahul","Dev","Nikhil","Siddharth","Priya","Ananya","Sneha","Divya","Pooja","Nisha","Kavya","Meera","Aditi","Riya","Ishaan","Dhruv","Aditya","Yash","Rishabh","Tanvi","Shreya","Isha","Nandini","Swati"];
const INDIAN_LAST_NAMES = ["Sharma","Verma","Singh","Kumar","Gupta","Mehta","Joshi","Patel","Reddy","Nair","Iyer","Rao","Mishra","Pandey","Agarwal","Chopra","Shah","Malhotra","Bose","Das","Kulkarni","Desai","Saxena","Tiwari","Srivastava"];
function randomBotName(): string {
  const first = INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)];
  const last = INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)];
  return `${first} ${last}`;
}

function simulateBotScore(userRating: number): number {
  // Bot difficulty scales with user rating so the match feels competitive
  if (userRating >= 1600) return 7 + Math.floor(Math.random() * 3);  // 7–9
  if (userRating >= 1400) return 6 + Math.floor(Math.random() * 3);  // 6–8
  if (userRating >= 1200) return 5 + Math.floor(Math.random() * 3);  // 5–7
  return 3 + Math.floor(Math.random() * 4);                          // 3–6
}

Deno.serve(async (req: Request) => {
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
      const botScore = simulateBotScore(rating.rating);
      const { data: match } = await sb.from("compete_matches").insert({
        player1_id: user.id,
        player2_id: null,
        player1_name: profile.full_name,
        player1_avatar: profile.avatar_url,
        player2_name: randomBotName(),
        player1_rating_before: rating.rating,
        player2_rating_before: rating.rating,
        player2_score: botScore,
        player1_target_exam: exam,
        player2_target_exam: exam,
        subject, topic: topics.length > 0 ? topics.join(", ") : "Any",
        question_ids: questionIds,
        total_questions: questionIds.length,
        status: "active",
        is_bot: true,
        started_at: new Date().toISOString(),
        countdown_until: new Date(Date.now() + 5000).toISOString(),
        current_question_started_at: new Date(Date.now() + 5000).toISOString(),
      }).select("*").single();
      return jsonResponse({ status: "matched", match_id: match!.id });
    }

    // ---------------------------------------------------------------------------
    // Helper: attempt to atomically claim an opponent using the DB function.
    // Returns the match_id if a new match was created, or a pre-existing match_id
    // if we were claimed by the opponent first, or null if no match could be made.
    // ---------------------------------------------------------------------------
    const attemptClaim = async (
      opponentRow: CompeteQueueEntry,
      p1Subject: string,
      p1Topics: string[],
      p1ClassLevel: string,
      p1TargetExam: string,
      p1Rating: number,
      p1Profile: ProfileMini,
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
      const oppExam = opponentRow.target_exam || "general";
      const { data: match } = await sb.from("compete_matches").insert({
        player1_id: user.id,
        player2_id: opponentRow.user_id,
        player1_name: p1Profile.full_name,
        player2_name: oppProfile.full_name,
        player1_avatar: p1Profile.avatar_url,
        player2_avatar: oppProfile.avatar_url,
        player1_rating_before: p1Rating,
        player2_rating_before: opponentRow.rating,
        player1_target_exam: p1TargetExam,
        player2_target_exam: oppExam,
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
      const matchId = (match as CompeteMatch)?.id;
      await sb.from("compete_queue").update({ match_id: matchId }).eq("user_id", opponentRow.user_id);
      // (We were already removed from queue by try_claim_opponent)
      return matchId as string;
    };

    // ---------------------------------------------------------------------------
    // POLL action
    // ---------------------------------------------------------------------------
    if (action === "poll") {
      const { data: q } = await sb.from("compete_queue").select("*").eq("user_id", user.id).maybeSingle();
      if (!q) return jsonResponse({ status: "waiting" });

      const queueEntry = q as CompeteQueueEntry;

      // Already matched by the opponent's "find" call
      if (queueEntry.match_id) {
        await sb.from("compete_queue").delete().eq("user_id", user.id);
        return jsonResponse({ status: "matched", match_id: queueEntry.match_id });
      }

      // Still waiting — re-attempt matching so simultaneous "find" race conditions resolve within one poll cycle
      const qSubject = queueEntry.subject || "Physics";
      const qExam = queueEntry.target_exam || "JEE Main";
      const qClass = queueEntry.class_level || "11";
      const qTopics: string[] = Array.isArray(queueEntry.topics) ? queueEntry.topics : [];
      const waitingCutoff = new Date(Date.now() - 20000).toISOString();

      const { data: same } = await sb.from("compete_queue").select("*").eq("status", "waiting").eq("subject", qSubject).eq("target_exam", qExam).eq("class_level", qClass).neq("user_id", user.id).gte("rating", queueEntry.rating - 200).lte("rating", queueEntry.rating + 200).order("created_at", { ascending: true }).limit(5);
      const { data: anyLevel } = await sb.from("compete_queue").select("*").eq("status", "waiting").eq("subject", qSubject).eq("target_exam", qExam).neq("user_id", user.id).lte("created_at", waitingCutoff).gte("rating", queueEntry.rating - 200).lte("rating", queueEntry.rating + 200).order("created_at", { ascending: true }).limit(5);
      const candidates = [...(same ?? []), ...(anyLevel ?? []).filter((c: CompeteQueueEntry) => !(same ?? []).some((s: CompeteQueueEntry) => s.user_id === c.user_id))];
      const opponent = candidates[0] ?? null;

      if (opponent) {
        const pollProfile = await getProfileMini(sb, user.id);
        const matchId = await attemptClaim(opponent, qSubject, qTopics, qClass, qExam, queueEntry.rating, pollProfile);
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
      ...(anyLevelCandidates ?? []).filter((c: CompeteQueueEntry) =>
        !(sameLevelCandidates ?? []).some((s: CompeteQueueEntry) => s.user_id === c.user_id)
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
