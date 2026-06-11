import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { Briefcase, ArrowRight, Clock, Check, X, Eye, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Row = {
  id: string;
  candidate_name: string;
  email: string;
  subject: string;
  total_experience: number;
  expected_ctc: number;
  status: string;
  photo_url: string | null;
  created_at: string;
};

const statusVariants: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  reviewed: { label: "Reviewed", className: "bg-primary/15 text-primary border-primary/30" },
  approved: { label: "Approved", className: "bg-secondary/15 text-secondary border-secondary/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const StaffDashboardPage = () => {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("educator_applications")
        .select("id,candidate_name,email,subject,total_experience,expected_ctc,status,photo_url,created_at")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    reviewed: rows.filter((r) => r.status === "reviewed").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    last7: rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length,
  };

  const recent = rows.slice(0, 5);

  if (role === "lead_manager") return <Navigate to="/admin/student-enquiry" replace />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-foreground">Enquiries Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of educator enquiries received via the ARKE landing page.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Enquiries", value: stats.total, color: "text-foreground", icon: Briefcase },
          { label: "Last 7 days", value: stats.last7, color: "text-primary", icon: TrendingUp },
          { label: "Pending", value: stats.pending, color: "text-warning", icon: Clock },
          { label: "Reviewed", value: stats.reviewed, color: "text-primary", icon: Eye },
          { label: "Approved", value: stats.approved, color: "text-secondary", icon: Check },
          { label: "Rejected", value: stats.rejected, color: "text-destructive", icon: X },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`mt-1 text-2xl font-black font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent enquiries */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-bold text-foreground">Recent Enquiries</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/educator-applications">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold text-foreground">No enquiries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enquiries from the "Join as an Educator" form will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => {
              const status = statusVariants[r.status] ?? statusVariants.pending;
              return (
                <li key={r.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                  <Avatar className="h-11 w-11 border border-border">
                    <AvatarImage src={r.photo_url ?? undefined} alt={r.candidate_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-sm">
                      {r.candidate_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{r.candidate_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <div className="hidden sm:block text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.subject}</span> · {r.total_experience} yrs
                  </div>
                  <div className="hidden md:block text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM, HH:mm")}
                  </div>
                  <Badge variant="outline" className={status.className}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StaffDashboardPage;
