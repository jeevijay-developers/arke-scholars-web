import { admin, corsHeaders, getOrCreateRating, getProfileMini, getUser, jsonResponse } from "../_shared/compete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const code = String(body.room_code || "").trim().toUpperCase();
    if (!code) return jsonResponse({ error: "Room code required" }, 400);

    const sb = admin();
    const { data: match } = await sb.from("compete_matches").select("*").eq("room_code", code).maybeSingle();
    if (!match) return jsonResponse({ error: "Room not found" }, 404);
    if (match.status !== "pending") return jsonResponse({ error: "Room already started" }, 400);
    if (match.player1_id === user.id) return jsonResponse({ match_id: match.id });

    const profile = await getProfileMini(sb, user.id);
    const rating = await getOrCreateRating(sb, user.id, profile.target_exam || "general");

    const { data: updated, error } = await sb.from("compete_matches").update({
      player2_id: user.id,
      player2_name: profile.full_name,
      player2_avatar: profile.avatar_url,
      player2_rating_before: rating.rating,
      status: "active",
      started_at: new Date().toISOString(),
      countdown_until: new Date(Date.now() + 5000).toISOString(),
      current_question_started_at: new Date(Date.now() + 5000).toISOString(),
    }).eq("id", match.id).eq("status", "pending").select("*").single();
    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({ match_id: updated.id });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
