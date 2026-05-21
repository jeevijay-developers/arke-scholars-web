// Shared helpers for compete edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function getUser(req: Request) {
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

export function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function getOrCreateRating(sb: ReturnType<typeof admin>, userId: string, exam: string) {
  const { data } = await sb
    .from("compete_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("target_exam", exam)
    .maybeSingle();
  if (data) return data;
  const { data: created } = await sb
    .from("compete_ratings")
    .insert({ user_id: userId, target_exam: exam })
    .select("*")
    .single();
  return created!;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function pickQuestionIds(
  sb: ReturnType<typeof admin>,
  subject: string,
  topics: string[],    // empty = any topic
  classLevel: string,
  targetExam: string,
  count = 10,
): Promise<string[]> {
  const activTopics = topics.filter((t) => t && t !== "Any");

  const fetchPool = async (topicFilter: string | null, useClassExam: boolean): Promise<string[]> => {
    let q = sb.from("compete_questions").select("id").eq("is_active", true).eq("subject", subject);
    if (topicFilter) q = q.eq("topic", topicFilter);
    if (useClassExam) {
      q = q.eq("class_level", classLevel).eq("target_exam", targetExam);
    }
    const { data } = await q.limit(60);
    return (data ?? []).map((r) => r.id as string);
  };

  let pool: string[] = [];

  if (activTopics.length > 0) {
    // Even distribution across selected topics
    const perTopic = Math.ceil(count / activTopics.length);
    for (const t of activTopics) {
      let ids = await fetchPool(t, true);
      if (ids.length === 0) ids = await fetchPool(t, false); // fallback: ignore class/exam
      pool.push(...shuffle(ids).slice(0, perTopic));
    }
  } else {
    // No topic filter — pull from full subject pool
    pool = await fetchPool(null, true);
    if (pool.length < count) {
      pool = await fetchPool(null, false); // fallback: ignore class/exam
    }
  }

  pool = shuffle([...new Set(pool)]); // deduplicate then shuffle

  // Final fallback: any active question at all
  if (pool.length < count) {
    const { data: d3 } = await sb.from("compete_questions").select("id").eq("is_active", true).limit(60);
    const extra = (d3 ?? []).map((r) => r.id as string).filter((id) => !pool.includes(id));
    pool.push(...shuffle(extra));
  }

  return pool.slice(0, count);
}

export function eloDelta(myRating: number, oppRating: number, score: number, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  return Math.round(k * (score - expected));
}

export async function getProfileMini(sb: ReturnType<typeof admin>, userId: string) {
  const { data } = await sb.from("profiles").select("full_name, avatar_url, target_exam, class_level").eq("user_id", userId).maybeSingle();
  return data ?? { full_name: "Player", avatar_url: null, target_exam: "general", class_level: null };
}

// Sentinel UUID used to represent the bot opponent (player2_id is null on bot matches).
export const BOT_SENTINEL_ID = "00000000-0000-0000-0000-000000000000";

// Determine the winner of a finished match. Returns null on a draw.
// For bot matches (player2_id is null), a bot win returns BOT_SENTINEL_ID instead of null
// so the UI can distinguish a bot victory from a true draw.
export function determineWinner(
  p1Score: number,
  p2Score: number,
  p1Id: string,
  p2Id: string | null,
): string | null {
  if (p1Score === p2Score) return null;
  if (p1Score > p2Score) return p1Id;
  return p2Id ?? BOT_SENTINEL_ID;
}

// Machinery-themed random bot opponent names. Picked fresh per match.
const BOT_NAME_PREFIXES = [
  "Turbo", "Hydro", "Nano", "Cyber", "Quantum", "Volt", "Servo", "Atomic",
  "Plasma", "Magnet", "Piston", "Gear", "Rotor", "Forge", "Diesel", "Neon",
  "Crank", "Flux", "Helix", "Kinetic", "Lithium", "Mecha", "Photon", "Sonic",
];
const BOT_NAME_SUFFIXES = [
  "Engine", "Drive", "Core", "Wrench", "Bolt", "Cog", "Forge", "Press",
  "Anvil", "Reactor", "Coil", "Turbine", "Piston", "Sprocket", "Hammer",
  "Lathe", "Drill", "Boiler", "Compressor", "Motor",
];

export function randomBotName(): string {
  const p = BOT_NAME_PREFIXES[Math.floor(Math.random() * BOT_NAME_PREFIXES.length)];
  const s = BOT_NAME_SUFFIXES[Math.floor(Math.random() * BOT_NAME_SUFFIXES.length)];
  const n = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${p}${s}-${n}`;
}

