import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Calendar, ExternalLink, Check, X, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Meeting = {
  id: string;
  title: string;
  agenda: string | null;
  meeting_url: string | null;
  meeting_at: string;
  duration_minutes: number;
  mentor_name?: string;
};

const StudentMentorMeetingCard = () => {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [response, setResponse] = useState<string>("no_response");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ann } = await supabase
      .from("mentor_announcements")
      .select("id, title, agenda, meeting_url, meeting_at, duration_minutes, mentor_id")
      .eq("status", "scheduled")
      .gt("meeting_at", new Date().toISOString())
      .order("meeting_at", { ascending: true })
      .limit(1);
    const m = (ann ?? [])[0];
    if (!m) {
      setMeeting(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", m.mentor_id)
      .maybeSingle();
    setMeeting({ ...m, mentor_name: prof?.full_name ?? "Your mentor" });
    const { data: rsvp } = await supabase
      .from("mentor_announcement_rsvps")
      .select("response")
      .eq("announcement_id", m.id)
      .eq("student_id", user.id)
      .maybeSingle();
    setResponse(rsvp?.response ?? "no_response");
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const respond = async (value: "attending" | "declined") => {
    if (!meeting || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("mentor_announcement_rsvps")
      .upsert(
        { announcement_id: meeting.id, student_id: user.id, response: value, responded_at: new Date().toISOString() },
        { onConflict: "announcement_id,student_id" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    setResponse(value);
    toast.success(value === "attending" ? "Marked as attending" : "Marked as can't make it");
  };

  if (loading || !meeting) return null;

  return (
    <div className="mb-6 rounded-xl border border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-secondary">Mentor meeting</p>
          <h3 className="font-display text-lg font-bold text-foreground mt-0.5">{meeting.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            With <span className="font-semibold text-foreground">{meeting.mentor_name}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(meeting.meeting_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {meeting.duration_minutes} min
            </span>
            {meeting.meeting_url && (
              <a href={meeting.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-secondary hover:underline">
                <ExternalLink className="h-4 w-4" /> Join link
              </a>
            )}
          </div>
          {meeting.agenda && <p className="mt-2 text-sm text-foreground/80">{meeting.agenda}</p>}

          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              variant={response === "attending" ? "default" : "outline"}
              onClick={() => respond("attending")}
              disabled={saving}
            >
              {saving && response !== "attending" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Attending
            </Button>
            <Button
              size="sm"
              variant={response === "declined" ? "default" : "outline"}
              onClick={() => respond("declined")}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-1" /> Can't make it
            </Button>
            {response !== "no_response" && (
              <span className="text-xs text-muted-foreground ml-2">Response saved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMentorMeetingCard;
