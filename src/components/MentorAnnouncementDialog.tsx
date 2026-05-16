import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar } from "lucide-react";
import type { MentorAnnouncement } from "@/hooks/useMentorAnnouncements";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mentorId: string;
  initial?: MentorAnnouncement | null;
  onSaved: () => void;
};

const recurrenceOptions = [
  { value: "one_off", label: "One-off (no repeat)" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "custom_days", label: "Custom (every N days)" },
];

const toLocalInputValue = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

const MentorAnnouncementDialog = ({ open, onOpenChange, mentorId, initial, onSaved }: Props) => {
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingAt, setMeetingAt] = useState(toLocalInputValue());
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState("one_off");
  const [intervalDays, setIntervalDays] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setAgenda(initial?.agenda ?? "");
      setMeetingUrl(initial?.meeting_url ?? "");
      setMeetingAt(toLocalInputValue(initial?.meeting_at));
      setDuration(initial?.duration_minutes ?? 60);
      setRecurrence(initial?.recurrence ?? "one_off");
      setIntervalDays(initial?.recurrence_interval_days ?? 15);
    }
  }, [open, initial]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a meeting title");
    if (!meetingAt) return toast.error("Pick a meeting date & time");
    const meetingDate = new Date(meetingAt);
    if (isNaN(meetingDate.getTime())) return toast.error("Invalid date");

    setSaving(true);
    const payload = {
      mentor_id: mentorId,
      title: title.trim(),
      agenda: agenda.trim() || null,
      meeting_url: meetingUrl.trim() || null,
      meeting_at: meetingDate.toISOString(),
      duration_minutes: duration,
      recurrence,
      recurrence_interval_days: recurrence === "custom_days" ? intervalDays : null,
    };

    let error;
    if (initial) {
      ({ error } = await supabase.from("mentor_announcements").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("mentor_announcements").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial ? "Meeting updated" : "Meeting announced — students notified");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary" />
            {initial ? "Edit meeting" : "Announce a meeting"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly check-in" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date & time</Label>
              <Input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Meeting link (optional)</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." />
          </div>
          <div>
            <Label>Agenda / notes</Label>
            <Textarea rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What will you cover?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrence === "custom_days" && (
              <div>
                <Label>Every N days</Label>
                <Input type="number" min={1} max={180} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Students assigned to you will be notified instantly. The next occurrence is auto-created after this meeting passes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial ? "Save" : "Announce"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MentorAnnouncementDialog;
