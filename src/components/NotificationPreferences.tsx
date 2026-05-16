import { useEffect, useState } from "react";
import { Bell, Mail, MessageCircle, MessageSquare, CalendarClock, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type Prefs = {
  email_mentor_message: boolean;
  email_doubt_answered: boolean;
  email_live_class_reminder: boolean;
  email_payment_receipt: boolean;
  email_system: boolean;
  inapp_mentor_message: boolean;
  inapp_doubt_answered: boolean;
  inapp_live_class_reminder: boolean;
  inapp_payment_receipt: boolean;
  inapp_system: boolean;
};

const DEFAULT_PREFS: Prefs = {
  email_mentor_message: true,
  email_doubt_answered: true,
  email_live_class_reminder: true,
  email_payment_receipt: true,
  email_system: true,
  inapp_mentor_message: true,
  inapp_doubt_answered: true,
  inapp_live_class_reminder: true,
  inapp_payment_receipt: true,
  inapp_system: true,
};

const CATEGORIES: Array<{
  key: "mentor_message" | "doubt_answered" | "live_class_reminder" | "payment_receipt" | "system";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "mentor_message",
    label: "Mentor messages",
    description: "Direct messages from your mentor",
    icon: MessageCircle,
  },
  {
    key: "doubt_answered",
    label: "Doubt answers",
    description: "When a teacher or AI answers your question",
    icon: MessageSquare,
  },
  {
    key: "live_class_reminder",
    label: "Live class reminders",
    description: "15 minutes before your scheduled class",
    icon: CalendarClock,
  },
  {
    key: "payment_receipt",
    label: "Payment receipts",
    description: "Confirmations for purchases and subscriptions",
    icon: CreditCard,
  },
  {
    key: "system",
    label: "System updates",
    description: "Account, security, and product news",
    icon: Sparkles,
  },
];

const Toggle = ({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!on)}
    disabled={disabled}
    className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
      on ? "bg-primary" : "bg-muted"
    }`}
    aria-pressed={on}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
        on ? "translate-x-4" : ""
      }`}
    />
  </button>
);

const NotificationPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const { id: _id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = data as any;
        setPrefs({ ...DEFAULT_PREFS, ...rest });
      }
      setLoading(false);
    })();
  }, [user]);

  const update = async (patch: Partial<Prefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Notification preferences</h3>
        </div>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="hidden sm:grid grid-cols-[1fr_auto_auto] items-center gap-6 px-5 py-2.5 border-b border-border bg-background/50">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Category</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
          <Bell className="h-3 w-3" /> In-app
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
          <Mail className="h-3 w-3" /> Email
        </span>
      </div>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const inappKey = `inapp_${cat.key}` as keyof Prefs;
        const emailKey = `email_${cat.key}` as keyof Prefs;
        return (
          <div
            key={cat.key}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-6 px-5 py-4 border-b border-border last:border-b-0"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{cat.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
              </div>
            </div>
            <Toggle on={prefs[inappKey]} onChange={(v) => update({ [inappKey]: v } as any)} disabled={saving} />
            <Toggle on={prefs[emailKey]} onChange={(v) => update({ [emailKey]: v } as any)} disabled={saving} />
          </div>
        );
      })}
    </div>
  );
};

export default NotificationPreferences;
