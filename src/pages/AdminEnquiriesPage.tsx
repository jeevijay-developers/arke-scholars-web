import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Inbox, Search, Loader2, Clock, CheckCircle2, AlertCircle, Archive, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  region: string | null;
  status: string;
  staff_notes: string | null;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  new: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-secondary/15 text-secondary border-secondary/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const sourceLabel: Record<string, string> = {
  contact: "Contact",
  admission: "Admission",
  mentorship: "Mentorship",
  other: "Other",
};

const AdminEnquiriesPage = () => {
  const { isSuperAdmin } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [active, setActive] = useState<Enquiry | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Enquiry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, sourceFilter]);
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 20);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: rows.length,
      new: rows.filter((r) => r.status === "new").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      resolvedWeek: rows.filter((r) => r.status === "resolved" && new Date(r.created_at).getTime() > weekAgo).length,
    };
  }, [rows]);

  const updateEnquiry = async (id: string, patch: Partial<Enquiry>) => {
    setSavingId(id);
    const { error } = await supabase.from("enquiries").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (active?.id === id) setActive({ ...active, ...patch });
    toast.success("Enquiry updated");
  };

  const deleteEnquiry = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete enquiry from ${name}?`,
      description: "This will permanently remove the enquiry and any internal notes. This cannot be undone.",
      confirmLabel: "Delete enquiry",
    });
    if (!ok) return;
    const { error } = await supabase.from("enquiries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (active?.id === id) setActive(null);
    toast.success("Enquiry deleted");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div>
        <h1 className="text-2xl font-black font-display text-foreground">Enquiry Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions from Contact, Admission and Mentorship forms.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", icon: Inbox },
          { label: "New", value: stats.new, color: "text-warning", icon: AlertCircle },
          { label: "In Progress", value: stats.inProgress, color: "text-primary", icon: Clock },
          { label: "Resolved (7d)", value: stats.resolvedWeek, color: "text-secondary", icon: CheckCircle2 },
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
              placeholder="Search name, email, phone or message"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="admission">Admission</SelectItem>
              <SelectItem value="mentorship">Mentorship</SelectItem>
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
            <Archive className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold text-foreground">No enquiries found</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paged.map((r) => (
              <li
                key={r.id}
                className="flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                onClick={() => setActive(r)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground truncate">{r.name}</p>
                    <Badge variant="outline" className="text-[10px]">{sourceLabel[r.source] ?? r.source}</Badge>
                    {r.region && <Badge variant="outline" className="text-[10px] uppercase">{r.region}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.email}{r.phone ? ` · ${r.phone}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{r.message}</p>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground">
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
                <SheetTitle>{active.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground break-all">{active.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{active.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium text-foreground capitalize">{active.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Region</p>
                    <p className="font-medium text-foreground capitalize">{active.region || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="font-medium text-foreground">{format(new Date(active.created_at), "dd MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Message</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {active.message}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Select
                    value={active.status}
                    onValueChange={(v) => updateEnquiry(active.id, { status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Internal notes</p>
                  <Textarea
                    rows={4}
                    defaultValue={active.staff_notes ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val !== (active.staff_notes ?? "")) {
                        updateEnquiry(active.id, { staff_notes: val });
                      }
                    }}
                    placeholder="Add an internal note (saved on blur)"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={savingId === active.id}
                    onClick={() => setActive(null)}
                  >
                    Close
                  </Button>
                  {isSuperAdmin && (
                    <Button
                      variant="destructive"
                      onClick={() => deleteEnquiry(active.id, active.name)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminEnquiriesPage;
