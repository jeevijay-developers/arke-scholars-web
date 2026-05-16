import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const doubtId = String(body.doubtId ?? "");
    const subject = String(body.subject ?? "");
    const question = String(body.question ?? "");

    if (!doubtId || !question.trim() || question.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: [
              "You are an expert tutor for Indian competitive exams (JEE, NEET, CUET, Class 11/12 boards) and Dubai curriculum (CBSE/IB/IGCSE).",
              "Your answer is shown to BOTH the student and the educator who reviews it. Make it useful for both.",
              "",
              "Always reply in clean GitHub-Flavored Markdown using EXACTLY this structure (omit a section only if truly not applicable):",
              "",
              "**Concept**",
              "1–2 line plain-language definition of the core idea.",
              "",
              "**Step-by-step solution**",
              "Numbered steps. Each step states what is being done and why. Use inline math like v = u + at (no LaTeX, no $...$).",
              "",
              "**Final answer**",
              "State the result clearly with units.",
              "",
              "**Key formulas / facts used**",
              "- Bullet list of formulas or facts referenced.",
              "",
              "**Common mistakes to avoid**",
              "- Short bullets a student typically gets wrong here.",
              "",
              "**Educator note**",
              "1–2 lines for the reviewing teacher: marking-scheme hint, alternate method, or what to probe if the student is still confused.",
              "",
              "Rules: Be precise and concise (max ~300 words). Never include API keys, credentials, links, or meta commentary. Never wrap the whole reply in a code block.",
            ].join("\n"),
          },
          { role: "user", content: `Subject: ${subject}\n\nStudent's doubt:\n${question}` },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "AI is busy. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const answer: string = aiJson.choices?.[0]?.message?.content ?? "Sorry, I could not generate an answer.";

    // Update doubt row with the AI answer (service role to bypass RLS for the system update)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    await admin
      .from("doubts")
      .update({ ai_answer: answer, status: "ai_solved", updated_at: new Date().toISOString() })
      .eq("id", doubtId);

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-doubt-solver error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
