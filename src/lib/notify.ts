import { supabase } from "@/integrations/supabase/client";

/**
 * Best-effort dispatch of an in-app notification + transactional email.
 * Honors the recipient's notification_preferences. Never throws — failures
 * are logged but never block the originating action.
 */
export type NotificationCategory =
  | "mentor_message"
  | "doubt_answered"
  | "live_class_reminder"
  | "payment_receipt"
  | "system";

const PREF_FIELDS: Record<NotificationCategory, { email: string; inapp: string }> = {
  mentor_message: { email: "email_mentor_message", inapp: "inapp_mentor_message" },
  doubt_answered: { email: "email_doubt_answered", inapp: "inapp_doubt_answered" },
  live_class_reminder: { email: "email_live_class_reminder", inapp: "inapp_live_class_reminder" },
  payment_receipt: { email: "email_payment_receipt", inapp: "inapp_payment_receipt" },
  system: { email: "email_system", inapp: "inapp_system" },
};

interface DispatchInput {
  recipientUserId: string;
  recipientEmail?: string | null;
  category: NotificationCategory;
  inApp: { title: string; body?: string; type?: string; link?: string | null };
  email?: {
    templateName: string;
    idempotencyKey: string;
    templateData?: Record<string, unknown>;
  };
}

const fetchPrefs = async (userId: string) => {
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
};

export const dispatchEmailOnly = async (params: {
  recipientUserId: string;
  recipientEmail: string;
  category: NotificationCategory;
  templateName: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}) => {
  const fields = PREF_FIELDS[params.category];
  let prefs: Record<string, boolean> | null = null;
  try {
    prefs = (await fetchPrefs(params.recipientUserId)) as any;
  } catch {
    /* ignore */
  }
  const wantsEmail = prefs ? !!prefs[fields.email] : true;
  if (!wantsEmail) return;
  try {
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: params.templateName,
        recipientEmail: params.recipientEmail,
        idempotencyKey: params.idempotencyKey,
        templateData: params.templateData,
      },
    });
  } catch (err) {
    console.warn("[notify] email-only send failed", err);
  }
};

export const dispatchNotification = async (input: DispatchInput) => {
  const fields = PREF_FIELDS[input.category];
  let prefs: Record<string, boolean> | null = null;
  try {
    prefs = (await fetchPrefs(input.recipientUserId)) as any;
  } catch {
    // ignore — defaults are "on"
  }
  const wantsInApp = prefs ? !!prefs[fields.inapp] : true;
  const wantsEmail = prefs ? !!prefs[fields.email] : true;

  if (wantsInApp) {
    try {
      await supabase.from("notifications").insert({
        user_id: input.recipientUserId,
        title: input.inApp.title,
        body: input.inApp.body,
        type: input.inApp.type ?? input.category,
        link: input.inApp.link ?? null,
      });
    } catch (err) {
      console.warn("[notify] in-app insert failed", err);
    }
  }

  if (wantsEmail && input.email && input.recipientEmail) {
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: input.email.templateName,
          recipientEmail: input.recipientEmail,
          idempotencyKey: input.email.idempotencyKey,
          templateData: input.email.templateData,
        },
      });
    } catch (err) {
      console.warn("[notify] email send failed", err);
    }
  }
};
