import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/hooks/useFavourites";
import { Heart, Star, Users, Loader2, GraduationCap, ArrowRight } from "lucide-react";
import coursePhysics from "@/assets/course-physics.png";
import courseChemistry from "@/assets/course-chemistry.png";
import courseMaths from "@/assets/course-maths.png";
import courseBiology from "@/assets/course-biology.png";

type Course = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  educator_name: string;
  thumbnail_url: string | null;
  rating: number;
  total_enrolled: number | null;
  price: number;
  original_price: number | null;
  discount_percent: number | null;
  badge: string | null;
};

const courseImages: Record<string, string> = {
  Physics: coursePhysics,
  Chemistry: courseChemistry,
  Maths: courseMaths,
  Biology: courseBiology,
};

const FavouriteCoursesPage = () => {
  const { user } = useAuth();
  const { favouriteIds, toggle: toggleFav } = useFavourites();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("course_favourites")
        .select("course_id, course:courses(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setCourses(((data ?? []) as { course: Course }[]).map((r) => r.course));
      setLoading(false);
    };
    load();
  }, [user?.id]);

  // Remove course from list immediately when unfavourited
  const visibleCourses = courses.filter((c) => favouriteIds.has(c.id));

  if (!user) {
    return (
      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-rose-500" />
          <h2 className="font-display text-xl font-black text-foreground">Sign in to see your favourites</h2>
          <p className="mt-2 text-sm text-muted-foreground">Save courses you love and revisit them anytime.</p>
          <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
            Login <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-0">
      <SEO title="Favourite Courses" description="Courses you've saved to your favourites on ARKE Scholars." />
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black text-foreground">Favourite Courses</h1>
              <p className="text-sm text-muted-foreground">
                {visibleCourses.length === 0
                  ? "No favourites yet"
                  : `${visibleCourses.length} course${visibleCourses.length === 1 ? "" : "s"} saved`}
              </p>
            </div>
          </div>
        </div>

        {visibleCourses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold text-foreground">No favourite courses yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse courses and click <span className="font-semibold text-rose-500">Add to Favourite</span> to save them here.
            </p>
            <Link
              to="/courses"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Browse Courses <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
            {visibleCourses.map((c) => {
              const img = c.thumbnail_url || courseImages[c.subject] || coursePhysics;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden hover-lift group flex flex-col"
                >
                  <Link to={`/courses/${c.slug}`} className="block">
                    <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-primary to-accent">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <img src={img} alt={c.subject} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-6 opacity-60" />
                      )}
                      {c.badge && (
                        <span className={`absolute top-3 left-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.badge === "Bestseller" ? "bg-amber-400 text-amber-950"
                          : c.badge === "Hot" ? "bg-red-500 text-white"
                          : c.badge === "New Launch" ? "bg-emerald-500 text-white"
                          : "bg-white/95 text-foreground"
                        }`}>{c.badge}</span>
                      )}
                    </div>
                  </Link>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[10px] font-bold text-primary uppercase">{c.subject}</p>
                    <Link to={`/courses/${c.slug}`} className="block">
                      <p className="text-sm font-bold text-foreground mt-1 line-clamp-2 hover:text-primary transition-colors">{c.name}</p>
                    </Link>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 text-accent fill-accent" /> {Number(c.rating).toFixed(1)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" /> {(c.total_enrolled ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2 mt-auto pt-3">
                      <Link
                        to={`/courses/${c.slug}`}
                        className="flex-1 rounded-xl border border-primary py-2 text-xs font-bold text-primary text-center hover:bg-primary/5 transition-colors"
                      >
                        View Course
                      </Link>
                      <button
                        onClick={() => toggleFav(c.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors shrink-0"
                        aria-label="Remove from favourites"
                      >
                        <Heart className="h-4 w-4 fill-rose-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavouriteCoursesPage;
