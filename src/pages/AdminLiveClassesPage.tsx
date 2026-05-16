import { useEffect, useMemo, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  Video,
  Calendar,
  Loader2,
  Plus,
  X,
  Trash2,
  Search,
  Pencil,
  ExternalLink,
  Copy,
  BookmarkPlus,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";

type AdminLive = {
  id: string;
  title: string;
  subject: string;
  educator_name: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  meeting_url: string | null;
  description: string | null;
  target_exam: string | null;
  created_by: string | null;
  course_id?: string | null;
  cancellation_reason?: string | null;
};

type Teacher = { user_id: string; full_name: string | null };
type Course = { id: string; name: string };

type Template = {
  id: string;
  name: string;
  title: string;
  subject: string;
  description: string | null;
  target_exam: string | null;
  educator_name: string | null;
  teacher_id: string | null;
  meeting_url: string | null;
  duration_minutes: number;
  max_participants: number | null;
};

const statusColors: Record<string, string> = {
  live: "bg-destructive text-white",
  scheduled: "bg-primary/20 text-primary",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

type FormState = {
  title: string;
  subject: string;
  teacherId: string;
  courseId: string;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string;
  description: string;
  target_exam: string;
};

const emptyForm: FormState = {
  title: "",
  subject: "",
  teacherId: "",
  courseId: "",
  starts_at: "",
  duration_minutes: 60,
  meeting_url: "",
  description: "",
  target_exam: "",
};

const buildJitsiUrl = (title: string) => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "class";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `https://meet.jit.si/arke-${slug}-${suffix}`;
};

const isAutoJitsi = (url: string) => url.startsWith("https://meet.jit.si/arke-");

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

const PAGE_SIZE = 25;

const AdminLiveClassesPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [classes, setClasses] = useState<AdminLive[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Templates dialog
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Cancellation dialog
  const [cancelTarget, setCancelTarget] = useState<AdminLive | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [classesRes, rolesRes, templatesRes, coursesRes] = await Promise.all([
      supabase
        .from("live_classes")
        .select(
          "id, title, subject, educator_name, status, starts_at, ends_at, meeting_url, description, target_exam, created_by, course_id, cancellation_reason",
        )
        .order("starts_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      supabase.from("live_class_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("courses").select("id, name").order("name"),
    ]);
    const teacherIds = (rolesRes.data ?? []).map((r) => r.user_id);
    const { data: profiles } = teacherIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", teacherIds)
      : { data: [] as Teacher[] };

    setClasses((classesRes.data ?? []) as AdminLive[]);
    setTeachers(
      ((profiles ?? []) as Teacher[]).sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      ),
    );
    setTemplates((templatesRes.data ?? []) as Template[]);
    setCourses((coursesRes.data ?? []) as Course[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, teacherFilter]);

  const counts = useMemo(() => {
    const now = new Date();
    return {
      live: classes.filter((r) => r.status === "live").length,
      upcoming: classes.filter((r) => r.status === "scheduled" && new Date(r.starts_at) > now).length,
      total: classes.length,
    };
  }, [classes]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.user_id, t])), [teachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (teacherFilter !== "all" && c.created_by !== teacherFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        (c.educator_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [classes, search, statusFilter, teacherFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (cls: AdminLive) => {
    const start = new Date(cls.starts_at).getTime();
    const end = cls.ends_at ? new Date(cls.ends_at).getTime() : start + 60 * 60 * 1000;
    const duration = Math.max(15, Math.round((end - start) / 60000));
    setEditingId(cls.id);
    setForm({
      title: cls.title,
      subject: cls.subject,
      teacherId: cls.created_by ?? "",
      courseId: cls.course_id ?? "",
      starts_at: toLocalInput(cls.starts_at),
      duration_minutes: duration,
      meeting_url: cls.meeting_url ?? "",
      description: cls.description ?? "",
      target_exam: cls.target_exam ?? "",
    });
    setShowForm(true);
  };

  // Duplicate an existing class — pre-fill form, blank start time
  const duplicateClass = (cls: AdminLive) => {
    const start = new Date(cls.starts_at).getTime();
    const end = cls.ends_at ? new Date(cls.ends_at).getTime() : start + 60 * 60 * 1000;
    const duration = Math.max(15, Math.round((end - start) / 60000));
    setEditingId(null);
    setForm({
      title: cls.title,
      subject: cls.subject,
      teacherId: cls.created_by ?? "",
      courseId: cls.course_id ?? "",
      starts_at: "",
      duration_minutes: duration,
      meeting_url: cls.meeting_url ?? "",
      description: cls.description ?? "",
      target_exam: cls.target_exam ?? "",
    });
    setShowForm(true);
    toast.success("Class duplicated — pick a new start time");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.teacherId || !form.starts_at) {
      toast.error("Title, subject, teacher and start time are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const adminId = userRes.user?.id;
      const teacher = teacherMap.get(form.teacherId);
      const startsAt = new Date(form.starts_at);
      const endsAt = new Date(startsAt.getTime() + form.duration_minutes * 60 * 1000);

      const payload = {
        title: form.title,
        subject: form.subject,
        educator_name: teacher?.full_name || "Educator",
        target_exam: form.target_exam || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        meeting_url: form.meeting_url || null,
        description: form.description || null,
        created_by: form.teacherId,
        course_id: form.courseId || null,
        scheduled_by: adminId,
      };

      if (editingId) {
        const { error } = await supabase.from("live_classes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Live class updated");
      } else {
        const { error } = await supabase
          .from("live_classes")
          .insert({ ...payload, status: "scheduled" });
        if (error) throw error;
        toast.success("Live class scheduled");
      }
      closeForm();
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save class");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this scheduled class?",
      description: "This will permanently remove the class. Students who registered will be notified. This action cannot be undone.",
      confirmLabel: "Delete class",
    });
    if (!ok) return;
    const { error } = await supabase.from("live_classes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class deleted");
    load();
  };

  const handleStatusChange = async (cls: AdminLive, status: string) => {
    if (status === "cancelled") {
      setCancelTarget(cls);
      setCancelReason("");
      return;
    }
    const update =
      cls.status === "cancelled" && status !== "cancelled"
        ? { status, cancellation_reason: null, cancelled_at: null, cancelled_by: null }
        : { status };
    const { error } = await supabase.from("live_classes").update(update).eq("id", cls.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked as ${status}`);
    load();
  };

  const submitCancellation = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    setCancelSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("live_classes")
      .update({
        status: "cancelled",
        cancellation_reason: cancelReason.trim(),
        cancelled_at: new Date().toISOString(),
        cancelled_by: userRes.user?.id ?? null,
      })
      .eq("id", cancelTarget.id);
    setCancelSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class cancelled");
    setCancelTarget(null);
    setCancelReason("");
    load();
  };

  // ---- Templates ----
  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Name your template");
      return;
    }
    if (!form.title || !form.subject) {
      toast.error("Need at least title and subject");
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const teacher = teacherMap.get(form.teacherId);
    const { error } = await supabase.from("live_class_templates").insert({
      name: templateName.trim(),
      title: form.title,
      subject: form.subject,
      description: form.description || null,
      target_exam: form.target_exam || null,
      educator_name: teacher?.full_name || null,
      teacher_id: form.teacherId || null,
      meeting_url: form.meeting_url || null,
      duration_minutes: form.duration_minutes,
      created_by: userRes.user?.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template saved");
    setShowSaveTemplate(false);
    setTemplateName("");
    load();
  };

  const useTemplate = (t: Template) => {
    setEditingId(null);
    setForm({
      title: t.title,
      subject: t.subject,
      teacherId: t.teacher_id ?? "",
      courseId: "",
      starts_at: "",
      duration_minutes: t.duration_minutes,
      meeting_url: t.meeting_url ?? "",
      description: t.description ?? "",
      target_exam: t.target_exam ?? "",
    });
    setShowTemplates(false);
    setShowForm(true);
  };

  const deleteTemplate = async (id: string) => {
    const ok = await confirm({
      title: "Delete this template?",
      description: "Future classes can no longer be created from this template.",
      confirmLabel: "Delete template",
    });
    if (!ok) return;
    const { error } = await supabase.from("live_class_templates").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template deleted");
    load();
  };

  // ---- Virtualized row ----
  const ROW_HEIGHT = 110;
  const ClassRow = ({ index, style }: RowComponentProps) => {
    const cls = pageRows[index];
    if (!cls) return null;
    return (
      <div style={style} className="px-1 pb-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow h-[98px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground truncate">{cls.title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  statusColors[cls.status] ?? statusColors.scheduled
                }`}
              >
                {cls.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {cls.educator_name} · {cls.subject}
              {cls.target_exam ? ` · ${cls.target_exam}` : ""}
            </p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground items-center flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(cls.starts_at).toLocaleString()}
              </span>
              {cls.meeting_url && (
                <a
                  href={cls.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Meeting link
                </a>
              )}
              {cls.status === "cancelled" && cls.cancellation_reason && (
                <span className="text-destructive truncate max-w-[280px]" title={cls.cancellation_reason}>
                  Reason: {cls.cancellation_reason}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={cls.status}
              onChange={(e) => handleStatusChange(cls, e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
              title="Change status"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => duplicateClass(cls)}
              className="rounded-md border border-border p-2 text-foreground hover:bg-muted"
              title="Duplicate class"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => openEdit(cls)}
              className="rounded-md border border-border p-2 text-foreground hover:bg-muted"
              title="Edit class"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(cls.id)}
              className="rounded-md border border-border p-2 text-destructive hover:bg-destructive/10"
              title="Delete class"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black font-display">Live Classes</h1>
            <p className="text-white/90 text-sm mt-1">Schedule and monitor classes on behalf of teachers</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/30"
            >
              <LayoutTemplate className="h-4 w-4" /> Templates ({templates.length})
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-white/90"
            >
              <Plus className="h-4 w-4" /> Schedule class
            </button>
          </div>
        </div>
        <div className="flex gap-4 mt-4 flex-wrap">
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{counts.live}</p>
            <p className="text-[10px] text-white/80">Live now</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{counts.upcoming}</p>
            <p className="text-[10px] text-white/80">Upcoming</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{counts.total}</p>
            <p className="text-[10px] text-white/80">Total</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, subject or teacher…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
        >
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
        >
          <option value="all">All teachers</option>
          {teachers.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.full_name || "Unnamed"}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {classes.length === 0 ? "No live classes scheduled yet." : "No classes match the filters."}
        </p>
      ) : (
        <>
          <div className="rounded-xl">
            <List
              rowComponent={ClassRow}
              rowCount={pageRows.length}
              rowHeight={ROW_HEIGHT}
              rowProps={{}}
              style={{ height: Math.min(pageRows.length, 8) * ROW_HEIGHT + 8 }}
            />
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Schedule / Edit dialog */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4"
          onClick={closeForm}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                {editingId ? "Edit live class" : "Schedule class on behalf of teacher"}
              </p>
              <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setForm((f) => {
                      const shouldRegen = !f.meeting_url || isAutoJitsi(f.meeting_url);
                      return {
                        ...f,
                        title: newTitle,
                        meeting_url: shouldRegen && newTitle.trim() ? buildJitsiUrl(newTitle) : f.meeting_url,
                      };
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Thermodynamics Crash Class"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Teacher</label>
                  <select
                    required
                    value={form.teacherId}
                    onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name || "Unnamed teacher"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
                  <input
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Physics"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Starts at</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duration (mins)</label>
                  <input
                    required
                    type="number"
                    min={15}
                    step={5}
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Target exam</label>
                  <input
                    value={form.target_exam}
                    onChange={(e) => setForm({ ...form, target_exam: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="JEE Main"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meeting URL</label>
                  <input
                    value={form.meeting_url}
                    onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="https://…"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Course (optional)</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">No course — standalone class</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Topics covered, prerequisites…"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowSaveTemplate(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <BookmarkPlus className="h-3.5 w-3.5" /> Save as template
              </button>
              <div className="flex flex-1 gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingId ? "Save changes" : "Schedule"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Save template dialog */}
      {showSaveTemplate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4"
          onClick={() => setShowSaveTemplate(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-foreground">Save as template</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reuse this title, subject, teacher, meeting link and duration for future classes.
            </p>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Weekly Physics Doubt Class"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={saveAsTemplate}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Save template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates list dialog */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4"
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Live class templates</p>
              <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                No templates yet. Save one from the schedule form to reuse later.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.title} · {t.subject} · {t.duration_minutes} min
                        {t.educator_name ? ` · ${t.educator_name}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => useTemplate(t)}
                        className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Cancellation reason dialog */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4"
          onClick={() => !cancelSubmitting && setCancelTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-foreground">Cancel "{cancelTarget.title}"?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Provide a reason — students will be able to see this on their schedule.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Teacher unavailable, rescheduling for next week"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelSubmitting}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
              >
                Keep class
              </button>
              <button
                onClick={submitCancellation}
                disabled={cancelSubmitting || !cancelReason.trim()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white hover:bg-destructive/90 disabled:opacity-60"
              >
                {cancelSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm cancellation
              </button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};

export default AdminLiveClassesPage;
