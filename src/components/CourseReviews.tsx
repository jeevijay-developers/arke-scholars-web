import { useEffect, useState } from "react";
import { Star, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
};

type Props = {
  courseId: string;
  enrolled: boolean;
};

const StarRow = ({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "md" | "lg";
}) => {
  const cls = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={`${cls} ${
              n <= value ? "fill-primary text-primary" : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const initials = (name?: string) =>
  (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

export const CourseReviews = ({ courseId, enrolled }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [carouselIdx, setCarouselIdx] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_reviews")
      .select("id, user_id, rating, review, created_at, updated_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    const list = (data ?? []) as Review[];

    if (list.length) {
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
      list.forEach((r) => {
        const p = map.get(r.user_id);
        r.reviewer_name = p?.full_name || "Student";
        r.reviewer_avatar = p?.avatar_url ?? null;
      });
    }
    setReviews(list);
    setLoading(false);

    if (user) {
      const mine = list.find((r) => r.user_id === user.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyText(mine.review || "");
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  const myReview = user ? reviews.find((r) => r.user_id === user.id) : undefined;
  const otherReviews = user ? reviews.filter((r) => r.user_id !== user.id) : reviews;

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct:
      reviews.length === 0
        ? 0
        : Math.round((reviews.filter((r) => r.rating === star).length / reviews.length) * 100),
  }));

  const handleSubmit = async () => {
    if (!user) return;
    if (myRating < 1) {
      toast.error("Please select a star rating");
      return;
    }
    setSaving(true);
    const payload = {
      course_id: courseId,
      user_id: user.id,
      rating: myRating,
      review: myText.trim() || null,
    };
    const { error } = await supabase
      .from("course_reviews")
      .upsert(payload, { onConflict: "course_id,user_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save review");
      return;
    }
    toast.success(myReview ? "Review updated" : "Thanks for your review!");
    load();
  };

  const handleDelete = async () => {
    if (!user || !myReview) return;
    const { error } = await supabase.from("course_reviews").delete().eq("id", myReview.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyRating(0);
    setMyText("");
    toast.success("Your review was removed");
    load();
  };

  const carouselReviews = reviews.slice(0, 12);
  const hasCarousel = carouselReviews.length > 0;
  const visible = carouselReviews.slice(carouselIdx, carouselIdx + 3);

  return (
    <section className="mt-10 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-black text-foreground">Ratings & Reviews</h3>
        <span className="text-xs text-muted-foreground">{reviews.length} review{reviews.length === 1 ? "" : "s"}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col items-center justify-center text-center md:border-r md:border-border md:pr-6">
          <p className="font-display text-5xl font-black text-foreground">{avg.toFixed(1)}</p>
          <StarRow value={Math.round(avg)} size="md" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Based on {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="space-y-1.5">
          {distribution.map((d) => (
            <div key={d.star} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-muted-foreground">{d.star}★</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-2 bg-primary transition-all" style={{ width: `${d.pct}%` }} />
              </div>
              <span className="w-10 text-right text-muted-foreground">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Write/edit review for enrolled users */}
      {enrolled && user ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">
              {myReview ? "Update your review" : "Share your experience"}
            </p>
            <StarRow value={myRating} onChange={setMyRating} size="lg" />
          </div>
          <Textarea
            value={myText}
            onChange={(e) => setMyText(e.target.value)}
            placeholder="What did you like? What could be improved?"
            rows={3}
          />
          <div className="flex items-center justify-end gap-2">
            {myReview && (
              <Button variant="outline" onClick={handleDelete} disabled={saving}>
                Delete
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={saving || myRating < 1}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {myReview ? "Update review" : "Submit review"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 flex items-center gap-3">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Only enrolled students can rate and review this course.
          </p>
        </div>
      )}

      {/* Carousel of reviews (visible to everyone) */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !hasCarousel ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No reviews yet. {enrolled ? "Be the first to review!" : ""}
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              What students say
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCarouselIdx((i) => Math.max(0, i - 1))}
                disabled={carouselIdx === 0}
                className="rounded-full border border-border p-1.5 disabled:opacity-40 hover:bg-muted/40"
                aria-label="Previous reviews"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() =>
                  setCarouselIdx((i) => Math.min(Math.max(carouselReviews.length - 3, 0), i + 1))
                }
                disabled={carouselIdx >= carouselReviews.length - 3}
                className="rounded-full border border-border p-1.5 disabled:opacity-40 hover:bg-muted/40"
                aria-label="Next reviews"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visible.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>
      )}

      {/* Full reviews list (excluding mine which is shown above as the editor) */}
      {otherReviews.length > 3 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            All reviews
          </p>
          <div className="space-y-3">
            {otherReviews.map((r) => (
              <ReviewCard key={r.id} review={r} compact />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const ReviewCard = ({ review, compact }: { review: Review; compact?: boolean }) => (
  <div className={`rounded-2xl border border-border bg-card p-4 ${compact ? "" : "h-full"}`}>
    <div className="flex items-center gap-2.5 mb-2">
      {review.reviewer_avatar ? (
        <img src={review.reviewer_avatar} alt={review.reviewer_name} className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-black text-primary-foreground">
          {initials(review.reviewer_name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground truncate">{review.reviewer_name}</p>
        <p className="text-[10px] text-muted-foreground">{formatDate(review.created_at)}</p>
      </div>
      <StarRow value={review.rating} size="sm" />
    </div>
    {review.review && (
      <p className={`text-xs text-foreground ${compact ? "" : "line-clamp-4"}`}>{review.review}</p>
    )}
  </div>
);

export default CourseReviews;
