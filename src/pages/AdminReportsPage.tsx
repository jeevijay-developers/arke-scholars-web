import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Flag, Search, Loader2, AlertTriangle, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_name: string;
  reported_role: string;
  category: string;
  subject: string;
  description: string;
  evidence_url: string | null;
  status: string;
  resolution_notes: string | null;
  handled_by: string | null;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-secondary/15 text-secondary border-secondary/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const categoryLabel: Record<string, string> = {
  misconduct: "Misconduct",
  inappropriate_content: "Inappropriate",
  no_show: "No-show",
  payment: "Payment",
  other: "Other",
};

const AdminReportsPage = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [active, setActive] = useState<Report | null>(null);
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Report[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setResolution(active?.resolution_notes ?? "");
  }, [active]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.subject.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.reported_name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, categoryFilter]);
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 20);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
  }), [rows]);

  const updateReport = async (patch: Partial<Report>) => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("reports")
      .update({ ...patch, handled_by: user?.id ?? null })
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...active, ...patch, handled_by: user?.id ?? null };
    setRows((prev) => prev.map((r) => (r.id === active.id ? updated : r)));
    setActive(updated);
    toast.success("Report updated — reporter will be notified");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-foreground">Report Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Student reports about teachers, mentors and staff. Update status to keep students informed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", icon: Flag },
          { label: "Pending", value: stats.pending, color: "text-warning", icon: AlertTriangle },
          { label: "In Progress", value: stats.inProgress, color: "text-primary", icon: Clock },
          { label: "Resolved", value: stats.resolved, color: "text-secondary", icon: CheckCircle2 },
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

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search subject, description or reported name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="misconduct">Misconduct</SelectItem>
              <SelectItem value="inappropriate_content">Inappropriate</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Flag className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold text-foreground">No reports yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Student-submitted reports will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paged.map((r) => (
              <li
                key={r.id}
                className="flex cursor-pointer items-start gap-4 p-4 hover:bg-muted/40 transition-colors"
                onClick={() => setActive(r)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                  <Flag className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground truncate">{r.subject}</p>
                    <Badge variant="outline" className="text-[10px]">{categoryLabel[r.category] ?? r.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Against <span className="font-semibold capitalize">{r.reported_role}</span>: {r.reported_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{r.description}</p>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground shrink-0">
                  {format(new Date(r.created_at), "dd MMM, HH:mm")}
                </div>
                <Badge variant="outline" className={statusStyle[r.status]}>
                  {r.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.subject}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Reported person</p>
                    <p className="font-medium text-foreground">{active.reported_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-medium text-foreground capitalize">{active.reported_role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium text-foreground">{categoryLabel[active.category]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="font-medium text-foreground">{format(new Date(active.created_at), "dd MMM yyyy, HH:mm")}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {active.description}
                  </div>
                </div>

                {active.evidence_url && (
                  <a
                    href={active.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View evidence <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Select
                    value={active.status}
                    onValueChange={(v) => updateReport({ status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resolution notes</p>
                  <Textarea
                    rows={4}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="What action was taken?"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={saving}
                    onClick={() => updateReport({ resolution_notes: resolution })}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save resolution"}
                  </Button>
                  <Button variant="outline" onClick={() => setActive(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminReportsPage;
