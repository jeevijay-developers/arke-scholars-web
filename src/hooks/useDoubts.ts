import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type DoubtRow = {
  id: string;
  user_id: string;
  subject: string;
  topic: string | null;
  question_text: string;
  image_url: string | null;
  status: string;
  ai_answer: string | null;
  assigned_teacher_id: string | null;
  created_at: string;
};

export const useDoubts = (mode: "mine" | "all" = "mine") => {
  const { user } = useAuth();
  const [doubts, setDoubts] = useState<DoubtRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      let q = supabase.from("doubts").select("*").order("created_at", { ascending: false });
      if (mode === "mine") q = q.eq("user_id", user.id);
      const { data } = await q;
      setDoubts((data ?? []) as DoubtRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`doubts-${mode}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "doubts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "doubt_answers" }, () => load())
      .subscribe();

    // Safety net: refetch when tab regains focus, in case a realtime event was missed.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, mode]);

  return { doubts, loading };
};
