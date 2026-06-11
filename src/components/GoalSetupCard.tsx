import { useEffect, useState } from "react";
import { Target, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const GOALS = [
  { value: "JEE", label: "JEE", desc: "Engineering aspirant" },
  { value: "NEET", label: "NEET", desc: "Medical aspirant" },
  { value: "Foundation", label: "Foundation", desc: "Class 8–10 prep" },
];

const DISMISS_KEY = "arke:goal_card_dismissed_v1";

const GoalSetupCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsExam, setNeedsExam] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1"
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("target_exam")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setLoading(false);
        return;
      }
      setNeedsExam(!data?.target_exam);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const save = async () => {
    if (!user || !selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ target_exam: selected, onboarding_completed: true })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your target exam. Please try again.");
      return;
    }
    toast.success(`Target exam set to ${selected}. Let's go!`);
    setNeedsExam(false);
  };

  if (loading || !needsExam || dismissed || !user) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-elevated animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black text-foreground">Pick your target exam to personalise Arke</h3>
            <p className="text-xs text-muted-foreground">We&apos;ll tailor courses, tests, and educators around it.</p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GOALS.map((g) => {
          const active = selected === g.value;
          return (
            <button
              key={g.value}
              onClick={() => setSelected(g.value)}
              className={`relative rounded-xl border p-3 text-left transition-all ${active
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border bg-card hover:border-primary/50"
                }`}
            >
              <div className="font-display text-sm font-bold text-foreground">{g.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{g.desc}</div>
              {active && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Maybe later
        </button>
        <button
          onClick={save}
          disabled={!selected || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F97415] px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  );
};

export default GoalSetupCard;
