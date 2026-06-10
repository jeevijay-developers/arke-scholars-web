import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Flag, Search, Loader2, AlertTriangle, Clock, CheckCircle2, XCircle, ExternalLink, ArrowRight } from "lucide-react";
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

type ReporterMeta = { full_name: string | null; role: string | null };
type ReporterMap = Record<string, ReporterMeta>;

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-400/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-400/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const statusIcon: Record<string, React.ReactNode> = {
  pending: <AlertTriangle className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
  dismissed: <XCircle className="h-3 w-3" />,
};

const categoryLabel: Record<string, string> = {
  misconduct: "Misconduct",
  inappropriate_content: "Inappropriate",
  no_show: "No-show",
  payment: "Payment",
  other: "Other",
};

const roleColor: Record<string, string> = {
  student: "bg-blue-500/10 text-blue-600",
  teacher: "bg-purple-500/10 text-purple-600",
  mentor: "bg-amber-500/10 text-amber-600",
  admin: "bg-rose-500/10 text-rose-600",
  super_admin: "bg-rose-500/10 text-rose-600",
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
};

const AdminReportsPage = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [reporterMap, setReporterMap] = useState<ReporterMap>({});
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

    const reports = (data as Report[]) ?? [];
    setRows(reports);

    // Batch-fetch reporter names + roles
    const ids = [...new Set(reports.map((r) => r.reporter_id).filter(Boolean))];
    if (ids.length > 0) {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const map: ReporterMap = {};
      ids.forEach((id) => { map[id] = { full_name: null, role: null }; });
      profiles?.forEach((p) => { if (map[p.id]) map[p.id].full_name = p.full_name; });
      roles?.forEach((r) => { if (map[r.user_id]) map[r.user_id].role = r.role; });
      setReporterMap(map);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setResolution(active?.resolution_notes ?? ""); }, [active]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!q) return true;
      const reporter = reporterMap[r.reporter_id]?.full_name?.toLowerCase() ?? "";
      return (
        r.subject.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.reported_name.toLowerCase().includes(q) ||
        reporter.includes(q)
      );
    });
  }, [rows, search, statusFilter, categoryFilter, reporterMap]);

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
    if (error) { toast.error(error.message); return; }
    const updated = { ...active, ...patch, handled_by: user?.id ?? null };
    setRows((prev) => prev.map((r) => (r.id === active.id ? updated : r)));
    setActive(updated);
    toast.success("Report updated");
  };

  const reporter = active ? reporterMap[active.reporter_id] : null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-foreground">Report Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Student reports about teachers, mentors and staff. Update status to keep students informed.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", icon: Flag },
          { label: "Pending", value: stats.pending, color: "text-amber-600", icon: AlertTriangle },
          { label: "In Progress", value: stats.inProgress, color: "text-primary", icon: Clock },
          { label: "Resolved", value: stats.resolved, color: "text-emerald-600", icon: CheckCircle2 },
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by subject, reporter or reported person"
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
            {paged.map((r) => {
              const rep = reporterMap[r.reporter_id];
              return (
                <li
                  key={r.id}
                  className="flex cursor-pointer items-start gap-4 p-4 hover:bg-muted/40 transition-colors"
                  onClick={() => setActive(r)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0 mt-0.5">
                    <Flag className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground truncate">{r.subject}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">{categoryLabel[r.category] ?? r.category}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        <span className="text-muted-foreground/60">Against</span>{" "}
                        <span className="font-semibold text-foreground capitalize">{r.reported_role}</span>:{" "}
                        <span className="font-medium">{r.reported_name}</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground/60">By</span>{" "}
                        <span className="font-medium text-foreground">{rep?.full_name ?? "Unknown"}</span>
                        {rep?.role && (
                          <span className="ml-1 capitalize text-muted-foreground">· {rep.role.replace("_", " ")}</span>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="hidden md:block text-[10px] text-muted-foreground">
                      {format(new Date(r.created_at), "dd MMM, HH:mm")}
                    </p>
                    <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${statusStyle[r.status]}`}>
                      {statusIcon[r.status]}
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* Detail drawer */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" aria-describedby={undefined}>
          {active && (
            <div className="flex flex-col h-full">
              {/* Drawer header */}
              <div className="bg-[#0F1729] px-6 pt-6 pb-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${statusStyle[active.status]}`}>
                    {statusIcon[active.status]}
                    {active.status.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/80">
                    {categoryLabel[active.category] ?? active.category}
                  </span>
                  <span className="ml-auto text-[11px] text-white/50">
                    {format(new Date(active.created_at), "dd MMM yyyy, HH:mm")}
                  </span>
                  <button
                    onClick={() => setActive(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <XCircle className="h-4 w-4 text-white/70" />
                  </button>
                </div>
                <SheetHeader>
                  <SheetTitle className="text-white text-lg font-bold leading-snug text-left">{active.subject}</SheetTitle>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Parties */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Parties Involved</p>
                  <div className="flex items-stretch gap-3">
                    {/* Reporter */}
                    <div className="flex-1 rounded-xl border border-border bg-muted/30 p-3.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Filed by</p>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 text-sm font-bold shrink-0">
                          {getInitials(reporter?.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {reporter?.full_name ?? "Unknown"}
                          </p>
                          {reporter?.role && (
                            <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColor[reporter.role] ?? "bg-muted text-muted-foreground"}`}>
                              {reporter.role.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                        <ArrowRight className="h-4 w-4 text-destructive" />
                      </div>
                    </div>

                    {/* Reported */}
                    <div className="flex-1 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-destructive/60 mb-2">Reported</p>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive text-sm font-bold shrink-0">
                          {getInitials(active.reported_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{active.reported_name}</p>
                          <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColor[active.reported_role] ?? "bg-muted text-muted-foreground"}`}>
                            {active.reported_role.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</p>
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {active.description}
                  </div>
                </div>

                {/* Evidence */}
                {active.evidence_url && (
                  <a
                    href={active.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    View evidence
                  </a>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Admin Actions</p>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Update Status</p>
                  <Select value={active.status} onValueChange={(v) => updateReport({ status: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Resolution notes */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Resolution Notes</p>
                  <Textarea
                    rows={4}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe what action was taken…"
                    className="resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pb-2">
                  <Button
                    className="flex-1"
                    disabled={saving}
                    onClick={() => updateReport({ resolution_notes: resolution })}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save resolution"}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setActive(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminReportsPage;
