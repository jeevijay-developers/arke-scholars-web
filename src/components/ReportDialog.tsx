import { useState } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type Props = {
  reportedName: string;
  reportedRole: "teacher" | "mentor" | "student" | "admin" | "other";
  reportedUserId?: string | null;
  trigger?: React.ReactNode;
};

const schema = z.object({
  category: z.enum(["misconduct", "inappropriate_content", "no_show", "payment", "other"]),
  subject: z.string().trim().min(3, "Add a short subject").max(150),
  description: z.string().trim().min(10, "Please add at least 10 characters").max(2000),
  evidence_url: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
});

const ReportDialog = ({ reportedName, reportedRole, reportedUserId, trigger }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: "misconduct" as "misconduct" | "inappropriate_content" | "no_show" | "payment" | "other",
    subject: "",
    description: "",
    evidence_url: "",
  });

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in to file a report");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId ?? null,
      reported_name: reportedName,
      reported_role: reportedRole,
      category: parsed.data.category,
      subject: parsed.data.subject,
      description: parsed.data.description,
      evidence_url: parsed.data.evidence_url || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted. Our team will review it shortly.");
    setOpen(false);
    setForm({ category: "misconduct", subject: "", description: "", evidence_url: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report {reportedName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="misconduct">Misconduct</SelectItem>
                <SelectItem value="inappropriate_content">Inappropriate content</SelectItem>
                <SelectItem value="no_show">Did not show up</SelectItem>
                <SelectItem value="payment">Payment issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rep-subject">Subject</Label>
            <Input
              id="rep-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Short title"
            />
          </div>
          <div>
            <Label htmlFor="rep-desc">Describe what happened</Label>
            <Textarea
              id="rep-desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add as much detail as possible"
            />
          </div>
          <div>
            <Label htmlFor="rep-evi">Evidence link (optional)</Label>
            <Input
              id="rep-evi"
              value={form.evidence_url}
              onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
