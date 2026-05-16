import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MentorAnnouncement = {
  id: string;
  mentor_id: string;
  title: string;
  agenda: string | null;
  meeting_url: string | null;
  meeting_at: string;
  duration_minutes: number;
  status: string;
  recurrence: string;
  recurrence_interval_days: number | null;
  recurrence_active: boolean;
  parent_template_id: string | null;
  created_at: string;
};

export type RsvpCounts = { attending: number; declined: number; no_response: number };

export function useMentorAnnouncements(mentorId: string | undefined) {
  const [items, setItems] = useState<MentorAnnouncement[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, RsvpCounts>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!mentorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("mentor_announcements")
      .select("*")
      .eq("mentor_id", mentorId)
      .order("meeting_at", { ascending: false });
    const list = (data ?? []) as MentorAnnouncement[];
    setItems(list);

    if (list.length) {
      const ids = list.map((a) => a.id);
      const { data: r } = await supabase
        .from("mentor_announcement_rsvps")
        .select("announcement_id, response")
        .in("announcement_id", ids);
      const counts: Record<string, RsvpCounts> = {};
      ids.forEach((id) => (counts[id] = { attending: 0, declined: 0, no_response: 0 }));
      (r ?? []).forEach((row: any) => {
        const c = counts[row.announcement_id];
        if (!c) return;
        if (row.response === "attending") c.attending += 1;
        else if (row.response === "declined") c.declined += 1;
        else c.no_response += 1;
      });
      setRsvps(counts);
    } else {
      setRsvps({});
    }
    setLoading(false);
  }, [mentorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, rsvps, loading, refresh };
}
