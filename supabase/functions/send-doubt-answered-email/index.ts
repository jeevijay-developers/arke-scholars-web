import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  studentUserId: string;
  studentName?: string;
  subject: string;
  doubtId: string;
  answerPreview?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.studentUserId || !body?.subject || !body?.doubtId) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Honor preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_doubt_answered")
      .eq("user_id", body.studentUserId)
      .maybeSingle();
    const wantsEmail = prefs ? !!prefs.email_doubt_answered : true;
    if (!wantsEmail) {
      return new Response(JSON.stringify({ skipped: "user_preference" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve student email via auth.admin
    const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(
      body.studentUserId,
    );
    if (userErr || !userResp?.user?.email) {
      return new Response(JSON.stringify({ error: "user_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = userResp.user.email;

    const { error: sendErr } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "doubt-answered",
          recipientEmail,
          idempotencyKey: `doubt-answered-${body.doubtId}`,
          templateData: {
            name: body.studentName || "Student",
            subject: body.subject,
            answerPreview: body.answerPreview || "",
            doubtUrl: "/doubts",
          },
        },
      },
    );
    if (sendErr) throw sendErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-doubt-answered-email error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
