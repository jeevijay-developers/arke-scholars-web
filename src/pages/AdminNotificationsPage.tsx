import { useState } from "react";
import { Send, Bell, Clock, Users, Eye } from "lucide-react";

const sentNotifications = [
  { title: "JEE Mock Test #12 Live Now", target: "JEE Students", sentTo: 4232, openRate: "68%", date: "2026-03-30" },
  { title: "New Physics Batch Starting", target: "All Students", sentTo: 12847, openRate: "42%", date: "2026-03-28" },
  { title: "Flash Sale: 50% Off Pro Plan", target: "Free Users", sentTo: 8432, openRate: "71%", date: "2026-03-25" },
  { title: "Live Class Reminder", target: "JEE 2026 Batch A", sentTo: 342, openRate: "89%", date: "2026-03-24" },
  { title: "Test Results Available", target: "Mock Test #11 Takers", sentTo: 1823, openRate: "94%", date: "2026-03-22" },
];

const AdminNotificationsPage = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [schedule, setSchedule] = useState("now");

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Send Form */}
      <div className="rounded-xl border border-border bg-card p-5 max-w-2xl mx-auto space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Send Push Notification</h2>

        <div>
          <label className="text-xs font-semibold text-foreground">Target Audience</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["All Students", "JEE Students", "NEET Students", "Class 11", "Class 12", "Free Users", "Pro Users"].map((t) => (
              <label key={t} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs cursor-pointer hover:bg-background">
                <input type="checkbox" className="rounded" />
                <span className="text-foreground">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground">Notification Title</label>
          <div className="relative mt-1">
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 50))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. New Mock Test Available" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{title.length}/50</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground">Notification Body</label>
          <div className="relative mt-1">
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 150))} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary" placeholder="Write your notification message..." />
            <span className="absolute right-3 bottom-2 text-[10px] text-muted-foreground">{body.length}/150</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground">Action URL (optional)</label>
          <input className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" placeholder="e.g. /tests/mock-12" />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground">Schedule</label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setSchedule("now")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${schedule === "now" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>Send Now</button>
            <button onClick={() => setSchedule("later")} className={`rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${schedule === "later" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}><Clock className="h-3 w-3" /> Schedule</button>
          </div>
          {schedule === "later" && (
            <input type="datetime-local" className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-background border border-border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Preview</p>
          <div className="rounded-lg bg-card border border-border p-3 flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0"><Bell className="h-4 w-4 text-primary-foreground" /></div>
            <div>
              <p className="text-xs font-bold text-foreground">{title || "Notification Title"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{body || "Notification body text will appear here..."}</p>
            </div>
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Send className="h-4 w-4" /> Send Notification
        </button>
      </div>

      {/* Sent History */}
      <div className="rounded-xl border border-border bg-card p-4 max-w-2xl mx-auto">
        <h2 className="text-sm font-bold text-foreground mb-3">Sent Notifications</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2 font-medium">Title</th><th className="text-left py-2 font-medium hidden sm:table-cell">Target</th><th className="text-right py-2 font-medium">Sent To</th><th className="text-right py-2 font-medium">Open Rate</th><th className="text-left py-2 font-medium hidden md:table-cell">Date</th></tr></thead>
            <tbody>
              {sentNotifications.map((n, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{n.title}</td>
                  <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{n.target}</td>
                  <td className="py-2.5 text-right text-foreground flex items-center justify-end gap-1"><Users className="h-3 w-3 text-muted-foreground" />{n.sentTo.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-medium text-secondary flex items-center justify-end gap-1"><Eye className="h-3 w-3" />{n.openRate}</td>
                  <td className="py-2.5 text-muted-foreground hidden md:table-cell">{n.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
