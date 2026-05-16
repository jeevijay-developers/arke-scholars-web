import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMentorAnnouncements, type MentorAnnouncement } from "@/hooks/useMentorAnnouncements";
import MentorAnnouncementDialog from "@/components/MentorAnnouncementDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Calendar, Clock, ExternalLink, Repeat, Users, X, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const recurrenceLabel = (a: MentorAnnouncement) => {
  switch (a.recurrence) {
    case "weekly": return "Repeats weekly";
    case "fortnightly": return "Repeats every 2 weeks";
    case "monthly": return "Repeats monthly";
    case "custom_days": return `Repeats every ${a.recurrence_interval_days ?? "?"} days`;
    default: return null;
  }
};

const MentorAnnouncementsPage = () => {
  const { user } = useAuth();
  const { items, rsvps, loading, refresh } = useMentorAnnouncements(user?.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MentorAnnouncement | null>(null);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming: MentorAnnouncement[] = [];
    const past: MentorAnnouncement[] = [];
    items.forEach((a) => {
      if (a.status === "cancelled" || new Date(a.meeting_at).getTime() < now) past.push(a);
      else upcoming.push(a);
    });
    upcoming.sort((a, b) => +new Date(a.meeting_at) - +new Date(b.meeting_at));
    return { upcoming, past };
  }, [items]);

  const cancel = async (a: MentorAnnouncement) => {
    const { error } = await supabase
      .from("mentor_announcements")
      .update({ status: "cancelled", recurrence_active: false })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Meeting cancelled");
    refresh();
  };

  const stopRecurrence = async (a: MentorAnnouncement) => {
    const { error } = await supabase
      .from("mentor_announcements")
      .update({ recurrence_active: false })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Recurrence stopped");
    refresh();
  };

  const renderCard = (a: MentorAnnouncement, isPast: boolean) => {
    const counts = rsvps[a.id] ?? { attending: 0, declined: 0, no_response: 0 };
    const rec = recurrenceLabel(a);
    return (
      <div key={a.id} className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg font-bold text-foreground">{a.title}</h3>
              {a.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
              {rec && a.recurrence_active && a.status !== "cancelled" && (
                <Badge variant="secondary" className="gap-1"><Repeat className="h-3 w-3" /> {rec}</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {fmtDate(a.meeting_at)}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {a.duration_minutes} min</span>
              {a.meeting_url && (
                <a href={a.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-secondary hover:underline">
                  <ExternalLink className="h-4 w-4" /> Join link
                </a>
              )}
            </div>
            {a.agenda && <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap">{a.agenda}</p>}
          </div>
          {!isPast && a.status !== "cancelled" && (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => cancel(a)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-emerald-600">{counts.attending} attending</span>
          <span className="text-red-600">{counts.declined} can't make it</span>
          <span className="text-muted-foreground">{counts.no_response} pending</span>
          {!isPast && a.recurrence !== "one_off" && a.recurrence_active && (
            <Button size="sm" variant="link" className="ml-auto h-auto p-0 text-xs" onClick={() => stopRecurrence(a)}>
              Stop recurrence
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground">Meeting Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule meetings with your mentees. Everyone gets notified instantly and can RSVP.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <CalendarPlus className="h-4 w-4 mr-2" /> Announce meeting
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No upcoming meetings. Click "Announce meeting" to schedule one.
              </div>
            ) : (
              <div className="space-y-3">{upcoming.map((a) => renderCard(a, false))}</div>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Past</h2>
              <div className="space-y-3 opacity-80">{past.slice(0, 10).map((a) => renderCard(a, true))}</div>
            </section>
          )}
        </>
      )}

      {user && (
        <MentorAnnouncementDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mentorId={user.id}
          initial={editing}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default MentorAnnouncementsPage;
