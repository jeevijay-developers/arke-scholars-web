import { useState } from "react";
import { Send, Bell, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AUDIENCES = ["All Students", "JEE Students", "NEET Students", "Class 11", "Class 12", "Free Users"];

const AdminNotificationsPage = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [schedule, setSchedule] = useState("now");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; title: string } | null>(null);

  const toggleAudience = (a: string) =>
    setSelected((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );

  const handleSend = async () => {
    if (selected.length === 0) return toast.error("Select at least one audience");
    if (!title.trim()) return toast.error("Title is required");
    if (!body.trim()) return toast.error("Body is required");

    setSending(true);
    const { data, error } = await (supabase as any).rpc("send_bulk_notification", {
      _title: title.trim(),
      _body: body.trim(),
      _type: "admin",
      _link: link.trim(),
      _audiences: selected,
    });
    setSending(false);

    if (error) {
      toast.error(error.message ?? "Failed to send notification");
      return;
    }

    const count = data as number;
    setLastResult({ count, title: title.trim() });
    toast.success(`Notification sent to ${count} student${count !== 1 ? "s" : ""}`);

    // Reset form
    setSelected([]);
    setTitle("");
    setBody("");
    setLink("");
    setSchedule("now");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div className="rounded-xl border border-border bg-card p-5 max-w-2xl mx-auto space-y-5">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Send Notification
        </h2>

        {/* Last sent banner */}
        {lastResult && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/10 border border-secondary/20 px-3 py-2.5 text-xs text-secondary font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Last sent: "{lastResult.title}" — delivered to {lastResult.count} student{lastResult.count !== 1 ? "s" : ""}
          </div>
        )}

        {/* Audience */}
        <div>
          <label className="text-xs font-semibold text-foreground">
            Target Audience <span className="text-destructive">*</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => {
              const checked = selected.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAudience(a)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${checked ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  {a}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Selected: {selected.join(", ")}
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-foreground">
            Title <span className="text-destructive">*</span>
          </label>
          <div className="relative mt-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="e.g. New Mock Test Available"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {title.length}/50
            </span>
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-semibold text-foreground">
            Message <span className="text-destructive">*</span>
          </label>
          <div className="relative mt-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 150))}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary"
              placeholder="Write your notification message..."
            />
            <span className="absolute right-3 bottom-2 text-[10px] text-muted-foreground">
              {body.length}/150
            </span>
          </div>
        </div>

        {/* Link */}
        <div>
          <label className="text-xs font-semibold text-foreground">Action URL (optional)</label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="e.g. /tests/mock-12"
          />
        </div>

        {/* Schedule */}
        <div>
          <label className="text-xs font-semibold text-foreground">Schedule</label>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setSchedule("now")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${schedule === "now" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted/50"}`}
            >
              Send Now
            </button>
            <button
              onClick={() => setSchedule("later")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${schedule === "later" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted/50"}`}
            >
              <Clock className="h-3 w-3" /> Schedule
            </button>
          </div>
          {schedule === "later" && (
            <input
              type="datetime-local"
              className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-background border border-border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Preview</p>
          <div className="rounded-lg bg-card border border-border p-3 flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <Bell className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{title || "Notification Title"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{body || "Notification body text will appear here..."}</p>
            </div>
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || selected.length === 0 || !title.trim() || !body.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
          ) : (
            <><Send className="h-4 w-4" /> Send Notification</>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
