import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Briefcase, Check, X, Mail, Phone, Calendar as CalIcon, GraduationCap, Building2, FileText, Video, ExternalLink, Loader2, Eye, Download, Clock, KeyRound, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type Application = {
  id: string;
  candidate_name: string;
  email: string;
  date_of_birth: string;
  contact_no: string;
  alt_contact_no: string | null;
  subject: string;
  class_level: string[] | null;
  highest_qualification: string;
  other_qualification: string | null;
  current_organization: string | null;
  previous_organization: string | null;
  total_experience: number;
  current_ctc: number | null;
  expected_ctc: number;
  photo_url: string | null;
  resume_url: string | null;
  demo_video_link: string;
  status: string;
  created_at: string;
};

const statusVariants: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  reviewed: { label: "Reviewed", className: "bg-primary/15 text-primary border-primary/30" },
  approved: { label: "Approved", className: "bg-secondary/15 text-secondary border-secondary/30" },
  credentials_sent: { label: "Credentials Sent", className: "bg-accent/15 text-accent border-accent/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

type AppStatus = "pending" | "reviewed" | "approved" | "credentials_sent" | "rejected";

const generateTempPassword = (length = 12) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const symbols = "!@#$%&*";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let pwd = "";
  for (let i = 0; i < length - 2; i++) pwd += chars[arr[i] % chars.length];
  pwd += symbols[arr[length - 2] % symbols.length];
  pwd += String(arr[length - 1] % 10);
  return pwd;
};

const escapeCsv = (val: unknown) => {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const AdminEducatorApplicationsPage = () => {
  const { isSuperAdmin } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);

  // Credential generation dialog state
  const [credApp, setCredApp] = useState<Application | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("educator_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load applications", { description: error.message });
    } else {
      setApps((data ?? []) as Application[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: AppStatus) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("educator_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error(`Could not update status`, { description: error.message });
    } else {
      toast.success(`Marked as ${status}`);
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      if (selected?.id === id) setSelected({ ...selected, status });
    }
    setUpdatingId(null);
  };

  const openCredentialDialog = (app: Application) => {
    setCredApp(app);
    setTempPassword(generateTempPassword());
    setProvisioned(false);
  };

  const provisionTeacher = async () => {
    if (!credApp) return;
    setProvisioning(true);
    const { data, error } = await supabase.functions.invoke("provision-teacher", {
      body: { application_id: credApp.id, password: tempPassword },
    });
    if (error || (data as { error?: string })?.error) {
      setProvisioning(false);
      const msg = (data as { error?: string })?.error || error?.message || "Could not generate credentials";
      toast.error(msg);
      return;
    }

    // Send credentials directly to the teacher's email
    const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "teacher-credentials",
        recipientEmail: credApp.email,
        idempotencyKey: `teacher-credentials-${credApp.id}-${Date.now()}`,
        templateData: {
          name: credApp.candidate_name,
          email: credApp.email,
          tempPassword,
          loginUrl: `${window.location.origin}/login`,
        },
      },
    });
    setProvisioning(false);

    if (emailError) {
      toast.error("Account created, but email could not be sent", {
        description: emailError.message,
      });
      return;
    }

    toast.success(`Credentials sent to ${credApp.email}`);
    setProvisioned(true);
    setApps((prev) =>
      prev.map((a) => (a.id === credApp.id ? { ...a, status: "credentials_sent" } : a)),
    );
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "Submitted", "Name", "Email", "Contact", "Alt Contact", "DOB", "Subject", "Class Level",
      "Highest Qualification", "Other Qualification", "Current Org", "Previous Org",
      "Experience (yrs)", "Current CTC", "Expected CTC", "Demo Video", "Resume", "Photo", "Status",
    ];
    const rows = filtered.map((a) => [
      format(new Date(a.created_at), "yyyy-MM-dd HH:mm"),
      a.candidate_name, a.email, a.contact_no, a.alt_contact_no ?? "",
      a.date_of_birth, a.subject, Array.isArray(a.class_level) ? a.class_level.join("; ") : (a.class_level ?? ""),
      a.highest_qualification, a.other_qualification ?? "",
      a.current_organization ?? "", a.previous_organization ?? "",
      a.total_experience, a.current_ctc ?? "", a.expected_ctc,
      a.demo_video_link, a.resume_url ?? "", a.photo_url ?? "", a.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arke-enquiries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} enquiries`);
  };

  const filtered = apps.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.candidate_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, 15);

  const counts = {
    all: apps.length,
    pending: apps.filter((a) => a.status === "pending").length,
    reviewed: apps.filter((a) => a.status === "reviewed").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  const deleteApp = async (a: Application) => {
    const ok = await confirm({
      title: `Delete application from ${a.candidate_name}?`,
      description:
        "This will permanently remove the application, uploaded resume metadata, and any decision history. This cannot be undone.",
      confirmLabel: "Delete application",
    });
    if (!ok) return;
    const { error } = await supabase.from("educator_applications").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setApps((prev) => prev.filter((x) => x.id !== a.id));
    if (selected?.id === a.id) setSelected(null);
    toast.success("Application deleted");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black font-display text-foreground">
            <Briefcase className="h-6 w-6 text-primary" /> Educator Enquiries
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">All "Join as an Educator" enquiries submitted via the ARKE landing page.</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Total", value: counts.all, color: "text-foreground" },
          { label: "Pending", value: counts.pending, color: "text-warning" },
          { label: "Reviewed", value: counts.reviewed, color: "text-primary" },
          { label: "Approved", value: counts.approved, color: "text-secondary" },
          { label: "Rejected", value: counts.rejected, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`mt-1 text-2xl font-black font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder="Search by name, email, or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} className="md:ml-auto">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-semibold text-foreground">No applications found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {apps.length === 0 ? "Applications submitted via the landing page will appear here." : "Try changing filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((a) => {
            const status = statusVariants[a.status] ?? statusVariants.pending;
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  {/* Photo + identity */}
                  <div className="flex items-center gap-3 lg:w-72 shrink-0">
                    <Avatar className="h-14 w-14 border-2 border-border">
                      <AvatarImage src={a.photo_url ?? undefined} alt={a.candidate_name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                        {a.candidate_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{a.candidate_name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {a.email}
                      </p>
                      <Badge variant="outline" className={`mt-1 ${status.className}`}>{status.label}</Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Subject</p>
                      <p className="font-semibold text-foreground flex items-center gap-1"><GraduationCap className="h-3 w-3 text-primary" />{a.subject}</p>
                      {a.class_level && a.class_level.length > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{Array.isArray(a.class_level) ? a.class_level.join(", ") : a.class_level}</p>}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Experience</p>
                      <p className="font-semibold text-foreground">{a.total_experience} yrs</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected CTC</p>
                      <p className="font-semibold text-foreground">₹{a.expected_ctc.toLocaleString()}/mo</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Applied</p>
                      <p className="font-semibold text-foreground">{format(new Date(a.created_at), "dd MMM yyyy")}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setSelected(a)}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    {a.resume_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={a.resume_url} target="_blank" rel="noreferrer" download>
                          <FileText className="h-3.5 w-3.5" /> Resume
                        </a>
                      </Button>
                    )}
                    {(a.status === "approved" || a.status === "credentials_sent") && (
                      <Button
                        size="sm"
                        variant={a.status === "credentials_sent" ? "outline" : "default"}
                        onClick={() => openCredentialDialog(a)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {a.status === "credentials_sent" ? "Re-issue" : "Generate Login"}
                      </Button>
                    )}
                    <Select
                      value={a.status}
                      onValueChange={(v) => updateStatus(a.id, v as AppStatus)}
                      disabled={updatingId === a.id}
                    >
                      <SelectTrigger className="w-[160px] h-9">
                        {updatingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending"><span className="flex items-center gap-2"><Clock className="h-3 w-3" /> Pending</span></SelectItem>
                        <SelectItem value="reviewed"><span className="flex items-center gap-2"><Eye className="h-3 w-3" /> Reviewed</span></SelectItem>
                        <SelectItem value="approved"><span className="flex items-center gap-2"><Check className="h-3 w-3" /> Approved</span></SelectItem>
                        <SelectItem value="credentials_sent"><span className="flex items-center gap-2"><KeyRound className="h-3 w-3" /> Credentials Sent</span></SelectItem>
                        <SelectItem value="rejected"><span className="flex items-center gap-2"><X className="h-3 w-3" /> Rejected</span></SelectItem>
                      </SelectContent>
                    </Select>
                    {isSuperAdmin && (
                      <Button size="sm" variant="destructive" onClick={() => deleteApp(a)} title="Delete (super admin)">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border-2 border-border">
                    <AvatarImage src={selected.photo_url ?? undefined} alt={selected.candidate_name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                      {selected.candidate_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl font-display">{selected.candidate_name}</DialogTitle>
                    <DialogDescription>{selected.subject} educator application</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2 mt-2 text-sm">
                <Field icon={Mail} label="Email" value={selected.email} />
                <Field icon={Phone} label="Contact" value={selected.contact_no} />
                <Field icon={Phone} label="Alt. Contact" value={selected.alt_contact_no || "—"} />
                <Field icon={CalIcon} label="Date of Birth" value={format(new Date(selected.date_of_birth), "dd MMM yyyy")} />
                <Field icon={GraduationCap} label="Subject" value={selected.subject} />
                <Field icon={GraduationCap} label="Class Level" value={selected.class_level && selected.class_level.length > 0 ? (Array.isArray(selected.class_level) ? selected.class_level.join(", ") : String(selected.class_level)) : "—"} />
                <Field icon={GraduationCap} label="Highest Qualification" value={selected.highest_qualification} />
                <Field icon={GraduationCap} label="Other Qualification" value={selected.other_qualification || "—"} />
                <Field icon={Building2} label="Current Organization" value={selected.current_organization || "—"} />
                <Field icon={Building2} label="Previous Organization" value={selected.previous_organization || "—"} />
                <Field icon={Briefcase} label="Total Experience" value={`${selected.total_experience} years`} />
                <Field icon={Briefcase} label="Current CTC" value={selected.current_ctc ? `₹${selected.current_ctc.toLocaleString()}/mo` : "—"} />
                <Field icon={Briefcase} label="Expected CTC" value={`₹${selected.expected_ctc.toLocaleString()}/mo`} />
                <Field icon={CalIcon} label="Submitted" value={format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")} />
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {selected.resume_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selected.resume_url} target="_blank" rel="noreferrer" download>
                      <FileText className="h-4 w-4" /> Download Resume
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={selected.demo_video_link} target="_blank" rel="noreferrer">
                    <Video className="h-4 w-4" /> Watch Demo Video <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                {selected.photo_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selected.photo_url} target="_blank" rel="noreferrer">
                      <Eye className="h-4 w-4" /> View Photo
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  {(selected.status === "approved" || selected.status === "credentials_sent") && (
                    <Button
                      size="sm"
                      onClick={() => {
                        openCredentialDialog(selected);
                        setSelected(null);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {selected.status === "credentials_sent" ? "Re-issue Login" : "Generate Login"}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => updateStatus(selected.id, v as AppStatus)}
                    disabled={updatingId === selected.id}
                  >
                    <SelectTrigger className="w-[180px]">
                      {updatingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending"><span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Pending</span></SelectItem>
                      <SelectItem value="reviewed"><span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Reviewed</span></SelectItem>
                      <SelectItem value="approved"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Approved</span></SelectItem>
                      <SelectItem value="credentials_sent"><span className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" /> Credentials Sent</span></SelectItem>
                      <SelectItem value="rejected"><span className="flex items-center gap-2"><X className="h-3.5 w-3.5" /> Rejected</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Credential generation dialog */}
      <Dialog
        open={!!credApp}
        onOpenChange={(o) => {
          if (!o) {
            setCredApp(null);
            setProvisioned(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          {credApp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <KeyRound className="h-5 w-5 text-primary" /> Generate Teacher Login
                </DialogTitle>
                <DialogDescription>
                  Creates a teacher account for <span className="font-semibold text-foreground">{credApp.candidate_name}</span>.
                  They'll be required to set a new password on first login.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Login Email</label>
                  <div className="mt-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground">
                    {credApp.email}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Temporary Password</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="font-mono text-sm"
                      disabled={provisioning}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setTempPassword(generateTempPassword())}
                      disabled={provisioning}
                      title="Regenerate"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Minimum 8 characters. Share via call or WhatsApp — never email.
                  </p>
                </div>

                {provisioned && (
                  <div className="rounded-lg border border-secondary/40 bg-secondary/10 p-3 text-xs text-foreground">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-secondary" /> Credentials sent
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      The temporary login has been emailed to{" "}
                      <span className="font-medium text-foreground">{credApp.email}</span>. They&apos;ll set a new password on first login.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-2 flex-wrap">
                {!provisioned ? (
                  <Button onClick={provisionTeacher} disabled={provisioning || tempPassword.length < 8}>
                    {provisioning ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send to email</>
                    )}
                  </Button>
                ) : (
                  <Button onClick={() => { setCredApp(null); setProvisioned(false); }}>
                    Done
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</p>
    <p className="mt-0.5 font-semibold text-foreground break-words">{value}</p>
  </div>
);

export default AdminEducatorApplicationsPage;
