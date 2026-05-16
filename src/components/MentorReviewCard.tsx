import { useEffect, useMemo, useState } from "react";
import { Star, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Review = {
  id: string;
  mentor_id: string;
  student_id: string;
  rating: number;
  review: string | null;
  updated_at: string;
};

const MentorReviewCard = () => {
  const { user } = useAppStore();
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Find assigned mentor
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: assignment } = await supabase
        .from("mentor_student_assignments")
        .select("mentor_id")
        .eq("student_id", user.id)
        .is("removed_at", null)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!assignment?.mentor_id) {
        setLoading(false);
        return;
      }
      setMentorId(assignment.mentor_id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", assignment.mentor_id)
        .maybeSingle();
      if (!cancelled) setMentorName(profile?.full_name || "Your Mentor");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load reviews + realtime
  useEffect(() => {
    if (!mentorId || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("mentor_reviews")
        .select("*")
        .eq("mentor_id", mentorId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const list = (data || []) as Review[];
      setReviews(list);
      const mine = list.find((r) => r.student_id === user.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyReview(mine.review || "");
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`mentor-reviews:${mentorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentor_reviews", filter: `mentor_id=eq.${mentorId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [mentorId, user?.id]);

  const avg = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const submit = async () => {
    if (!user?.id || !mentorId) return;
    if (myRating < 1) {
      toast({ title: "Please pick a rating", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("mentor_reviews")
      .upsert(
        {
          mentor_id: mentorId,
          student_id: user.id,
          rating: myRating,
          review: myReview.trim() || null,
        },
        { onConflict: "mentor_id,student_id" },
      );
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save review", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Thanks for your feedback!" });
  };

  if (loading || !mentorId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-base font-black text-foreground">Rate your mentor</h3>
          <p className="text-xs text-muted-foreground">
            Share how {mentorName} is helping you. Your feedback updates in real time.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-display text-lg font-black text-foreground">
              {avg ? avg.toFixed(1) : "—"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hoverRating || myRating) >= n;
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setMyRating(n)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              <Star className={`h-7 w-7 ${active ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
            </button>
          );
        })}
      </div>

      <Textarea
        value={myReview}
        onChange={(e) => setMyReview(e.target.value.slice(0, 500))}
        placeholder="Share what's working well or what could improve…"
        className="min-h-[80px] mb-2"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{myReview.length}/500</span>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {reviews.some((r) => r.student_id === user?.id) ? "Update review" : "Submit review"}
        </button>
      </div>

      {reviews.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground mb-2">Recent feedback</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 ${r.rating >= n ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                    />
                  ))}
                  {r.student_id === user?.id && (
                    <span className="ml-2 text-[10px] font-semibold text-primary">You</span>
                  )}
                </div>
                {r.review && <p className="text-xs text-muted-foreground">{r.review}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorReviewCard;
