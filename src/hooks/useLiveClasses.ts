import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveClassRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  educator_name: string;
  educator_avatar: string | null;
  target_exam: string | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
  meeting_url: string | null;
  recording_url: string | null;
  description: string | null;
  created_by: string | null;
  course_id: string | null;
};

export const useLiveClasses = (filter: "all" | "live" | "upcoming" | "past" = "all") => {
  const [classes, setClasses] = useState<LiveClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      let q = supabase.from("live_classes").select("*").order("starts_at", { ascending: true });
      if (filter === "live") q = q.eq("status", "live");
      else if (filter === "upcoming") q = q.gte("starts_at", now).neq("status", "completed");
      else if (filter === "past") q = q.eq("status", "completed");
      const { data } = await q;
      setClasses((data ?? []) as LiveClassRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`live-classes:${filter}:${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_classes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  return { classes, loading };
};
