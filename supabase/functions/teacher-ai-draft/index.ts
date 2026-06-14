import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: { method: string; headers: { get: (arg0: string) => any; }; json: () => any; }) => {
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
    const subject = String(body.subject ?? "");
    const topic = String(body.topic ?? "");
    const question = String(body.question ?? "");
    const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

    if (!question.trim() && !imageUrl) {
      return new Response(JSON.stringify({ error: "Provide a question or image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (question.length > 6000) {
      return new Response(JSON.stringify({ error: "Question too long" }), {
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

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Subject: ${subject}${topic ? ` | Topic: ${topic}` : ""}\n\nStudent's doubt:\n${question || "(see attached image)"}`,
      },
    ];
    if (imageUrl) {
      userContent.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let aiJson: any = null;
    let lastErrorStatus = 500;
    let lastErrorText = "Unknown AI gateway error";

    for (const model of models) {
      try {
        const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: [
                  "You are drafting an answer for a human educator who will REVIEW and EDIT it before sending to the student.",
                  "Read both the question text and any attached image carefully (it may contain the actual problem, a diagram, or handwriting).",
                  "Reply in clean GitHub-Flavored Markdown:",
                  "",
                  "**Concept**",
                  "1–2 line plain-language definition.",
                  "",
                  "**Step-by-step solution (if any)**",
                  "Numbered steps. Use inline math like v = u + at (no LaTeX).",
                  "",
                  "**Final answer (if any)**",
                  "Result with units.",
                  "",
                  "**Key formulas / facts used (if any)**",
                  "- Bullets.",
                  "",
                  "**Common mistakes to avoid (if any)**",
                  "- Bullets.",
                  "",
                  "Rules: precise, concise (max ~350 words). No meta commentary. No code-fence wrapping the whole reply.",
                ].join("\n"),
              },
              { role: "user", content: userContent },
            ],
          }),
        });

        if (aiResp.status === 429) {
          console.warn(`[AI] ${model} rate-limited, trying next...`);
          lastErrorStatus = 429;
          lastErrorText = "AI is busy. Try again in a moment.";
          continue;
        }
        if (aiResp.status === 402) {
          console.warn(`[AI] ${model} payment/quota exceeded, trying next...`);
          lastErrorStatus = 402;
          lastErrorText = "AI credits exhausted. Please contact support.";
          continue;
        }
        if (!aiResp.ok) {
          const t = await aiResp.text();
          console.error(`[AI] ${model} error ${aiResp.status}:`, t);
          lastErrorStatus = aiResp.status;
          lastErrorText = t || `AI gateway error ${aiResp.status}`;
          continue;
        }

        aiJson = await aiResp.json();
        if (aiJson.choices?.[0]?.message?.content) {
          console.log(`[AI] Success with model: ${model}`);
          break;
        }
      } catch (err) {
        console.error(`[AI] Error calling model ${model}:`, err);
        lastErrorText = err instanceof Error ? err.message : String(err);
      }
    }

    if (!aiJson || !aiJson.choices?.[0]?.message?.content) {
      return new Response(JSON.stringify({ error: lastErrorText }), {
        status: lastErrorStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const draft: string = aiJson.choices[0].message.content ?? "";

    return new Response(JSON.stringify({ draft }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("teacher-ai-draft error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
