import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";

export const useFavourites = () => {
  const { user } = useAuth();
  const { favouriteIds, setFavouriteIds, toggleFavouriteId } = useAppStore();

  // Load once when user becomes available (or on first mount if already logged in).
  // Guard with a ref-like check: only fetch if store is empty and user exists.
  useEffect(() => {
    if (!user) {
      setFavouriteIds(new Set());
      return;
    }
    (supabase as any)
      .from("course_favourites")
      .select("course_id")
      .eq("user_id", user.id)
      .then(({ data }: { data: { course_id: string }[] | null }) => {
        setFavouriteIds(new Set((data ?? []).map((r) => r.course_id)));
      });
  }, [user?.id]);

  const toggle = useCallback(
    async (courseId: string) => {
      if (!user) {
        toast.info("Sign in to save favourites");
        return;
      }
      const isFav = favouriteIds.has(courseId);
      // Optimistic update — all subscribers (navbar, detail page, etc.) see it instantly
      toggleFavouriteId(courseId);

      const { error } = isFav
        ? await (supabase as any)
            .from("course_favourites")
            .delete()
            .eq("user_id", user.id)
            .eq("course_id", courseId)
        : await (supabase as any)
            .from("course_favourites")
            .insert({ user_id: user.id, course_id: courseId });

      if (error) {
        // Roll back
        toggleFavouriteId(courseId);
        toast.error("Could not update favourites");
      } else {
        toast.success(isFav ? "Removed from favourites" : "Added to favourites ♥");
      }
    },
    [user, favouriteIds, toggleFavouriteId],
  );

  return { favouriteIds, count: favouriteIds.size, toggle };
};
