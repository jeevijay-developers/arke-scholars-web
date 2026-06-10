import { Shield, Flag, Check, Eye, Loader2, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_name: string;
  reported_role: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  evidence_url: string | null;
  resolution_notes: string | null;
  created_at: string;
};

const severityFromCategory = (cat: string): "high" | "medium" | "low" => {
  if (["abuse", "harassment", "fraud", "exam_paper_leak"].includes(cat)) return "high";
  if (["spam", "inappropriate"].includes(cat)) return "medium";
  return "low";
};

const severityColors: Record<string, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-amber-500/20 text-amber-600",
  low: "bg-muted text-muted-foreground",
};

const AdminModerationPage = () => {
  const { isSuperAdmin } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setReports((data as Report[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (r: Report, status: "resolved" | "dismissed") => {
    setUpdatingId(r.id);
    const { error } = await supabase.from("reports").update({ status }).eq("id", r.id);
    setUpdatingId(null);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Marked resolved" : "Report dismissed");
    load();
  };

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      pending: reports.filter((r) => r.status === "pending").length,
      resolvedWeek: reports.filter((r) => r.status === "resolved" && new Date(r.created_at).getTime() > weekAgo).length,
      total: reports.length,
    };
  }, [reports]);

  const pending = reports.filter((r) => r.status === "pending");

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div className="rounded-2xl bg-[#0F1729] p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-7 w-7" />
          <h1 className="text-2xl font-black font-display">Content Moderation</h1>
        </div>
        <p className="text-white/90 text-sm">Review flagged content from students and take action.</p>
        <div className="flex gap-4 mt-4">
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{stats.pending}</p>
            <p className="text-[10px] text-white/80">Pending</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{stats.resolvedWeek}</p>
            <p className="text-[10px] text-white/80">Resolved (7d)</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-white/80">All time</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold text-foreground">No pending reports</p>
          <p className="text-xs text-muted-foreground">When a student flags a doubt, chat or profile, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((r) => {
            const severity = severityFromCategory(r.category);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                    <Flag className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground uppercase">{r.category.replace("_", " ")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${severityColors[severity]}`}>{severity}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{r.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported {r.reported_role}: <span className="font-semibold text-foreground">{r.reported_name}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.evidence_url && (
                      <a
                        href={r.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                        title="View evidence"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      disabled={updatingId === r.id}
                      onClick={() => setStatus(r, "resolved")}
                      className="rounded-lg p-2 text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-50"
                      title="Mark resolved"
                    >
                      {updatingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    {isSuperAdmin && (
                      <button
                        disabled={updatingId === r.id}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Dismiss this report?",
                            description: "Dismissed reports are kept for audit but removed from the queue. The reporter will be notified.",
                            confirmLabel: "Dismiss report",
                            variant: "default",
                          });
                          if (ok) setStatus(r, "dismissed");
                        }}
                        className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Dismiss"
                      >
                        <ShieldOff className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminModerationPage;
