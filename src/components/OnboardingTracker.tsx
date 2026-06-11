import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Target, User as UserIcon, Video, BookOpen, ClipboardCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Step {
  key: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  link: string;
  done: boolean;
}

const DISMISS_KEY = "arke:onboarding_celebrated_v1";

const OnboardingTracker = () => {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const [profileRes, attendanceRes, lessonRes, testRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, city, target_exam").eq("user_id", user.id).maybeSingle(),
        supabase.from("live_class_attendance").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (!active) return;

      const profile = profileRes.data;
      const next: Step[] = [
        {
          key: "profile",
          label: "Complete your profile",
          desc: "Add name, phone & city",
          icon: UserIcon,
          link: "/profile",
          done: !!(profile?.full_name && profile?.phone && profile?.city),
        },
        {
          key: "goal",
          label: "Set your target exam",
          desc: "We tailor everything around it",
          icon: Target,
          link: "/profile",
          done: !!profile?.target_exam,
        },
        {
          key: "class",
          label: "Register for a live class",
          desc: "Join your first session",
          icon: Video,
          link: "/my-live-classes",
          done: (attendanceRes.count ?? 0) > 0,
        },
        {
          key: "lesson",
          label: "Watch your first lesson",
          desc: "Start a course",
          icon: BookOpen,
          link: "/courses",
          done: (lessonRes.count ?? 0) > 0,
        },
        {
          key: "test",
          label: "Attempt your first test",
          desc: "Benchmark yourself",
          icon: ClipboardCheck,
          link: "/my-tests",
          done: (testRes.count ?? 0) > 0,
        },
      ];
      setSteps(next);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  if (!user || !steps || dismissed) return null;
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);
  const allDone = completed === steps.length;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-base font-black text-foreground">
            {allDone ? "🎉 You're all set up!" : "Get started with Arke"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allDone ? "You've completed onboarding." : `${completed} of ${steps.length} steps complete`}
          </p>
        </div>
        {allDone && (
          <button
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-4 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-[#F97415] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => {
          const Icon = s.done ? CheckCircle2 : Circle;
          return (
            <Link
              key={s.key}
              to={s.link}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${s.done
                  ? "border-secondary/30 bg-secondary/5"
                  : "border-border hover:border-primary/40 hover:bg-background/50"
                }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${s.done ? "text-secondary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${s.done ? "text-foreground line-through opacity-70" : "text-foreground"}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
              <s.icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingTracker;
