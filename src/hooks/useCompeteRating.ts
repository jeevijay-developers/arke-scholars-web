import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type CompeteRating = {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  best_streak: number;
};

const DEFAULT: CompeteRating = { rating: 1000, wins: 0, losses: 0, draws: 0, current_streak: 0, best_streak: 0 };

export const useCompeteRating = () => {
  const { user } = useAuth();
  const [rating, setRating] = useState<CompeteRating>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setRating(DEFAULT);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("target_exam").eq("user_id", user.id).maybeSingle();
    const exam = profile?.target_exam || "general";
    const { data } = await supabase
      .from("compete_ratings")
      .select("rating, wins, losses, draws, current_streak, best_streak")
      .eq("user_id", user.id)
      .eq("target_exam", exam)
      .maybeSingle();
    setRating(data ?? DEFAULT);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { rating, loading, refresh };
};
