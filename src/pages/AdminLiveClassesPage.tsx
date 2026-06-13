import { useEffect, useMemo, useState } from "react";
import {
  Video,

  Loader2,
  Plus,
  X,
  Trash2,
  Search,
  Pencil,
  Copy,
  BookmarkPlus,
  LayoutTemplate,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import TablePagination from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

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
  zoom_meeting_id?: string | null;
  zoom_meeting_password?: string | null;
};

type Teacher = { user_id: string; full_name: string | null };
type Course = { id: string; name: string; target?: string | null; class?: string | null };
type Exam = { id: string; name: string };

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

type RecordedVideo = {
  id: string;
  title: string;
  subject: string;
  recording_url: string;
  starts_at: string;
  educator_name: string;
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
  description: string;
  target_exam: string;
  class: string;
};

const emptyForm: FormState = {
  title: "",
  subject: "",
  teacherId: "",
  courseId: "",
  starts_at: "",
  duration_minutes: 60,
  description: "",
  target_exam: "",
  class: "",
};


const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

const getClassesForExam = (examName: string) => {
  const name = examName?.toUpperCase() || "";
  if (name.includes("JEE") || name.includes("NEET")) {
    return ["11", "12", "dropper"];
  }
  if (name.includes("FOUNDATION")) {
    return ["8", "9", "10"];
  }
  return [];
};

const PAGE_SIZE = 25;

const AdminLiveClassesPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [classes, setClasses] = useState<AdminLive[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeTab, setActiveTab] = useState<"live" | "recorded">("live");
  const [recordedVideos, setRecordedVideos] = useState<RecordedVideo[]>([]);
  const [recordedLoading, setRecordedLoading] = useState(false);

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");

  // Templates dialog
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Cancellation dialog
  const [cancelTarget, setCancelTarget] = useState<AdminLive | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const loadRecordedVideos = async () => {
    setRecordedLoading(true);
    const { data, error } = await supabase
      .from("live_classes")
      .select("id, title, subject, recording_url, starts_at, educator_name")
      .not("recording_url", "is", null)
      .order("starts_at", { ascending: false });

    if (error) {
      toast.error("Failed to load recorded videos");
    } else {
      setRecordedVideos((data ?? []) as RecordedVideo[]);
    }
    setRecordedLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const [classesRes, rolesRes, templatesRes, coursesRes, examsRes] = await Promise.all([
      supabase
        .from("live_classes")
        .select(
          "id, title, subject, educator_name, status, starts_at, ends_at, meeting_url, description, target_exam, created_by, course_id, cancellation_reason",
        )
        .order("starts_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      supabase.from("live_class_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("courses").select("id, name, target, class").order("name"),
      supabase.from("exams").select("id, name").order("name"),
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
    setExams((examsRes.data ?? []) as Exam[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadRecordedVideos();
  }, []);


  const viewRecordedVideo = (video: RecordedVideo) => {
    window.open(video.recording_url, "_blank");
  };

  const downloadRecordedVideo = async (video: RecordedVideo) => {
    try {
      // Extract filename from recording URL
      const url = new URL(video.recording_url);
      const pathname = url.pathname;
      const filename = pathname.split("/").pop() || "recording.m3u8";

      const { data, error } = await supabase.functions.invoke("manage-s3-recordings", {
        body: {
          action: "download",
          filename,
        },
      });
      if (error || !data?.url) {
        toast.error("Failed to generate download link");
        return;
      }
      const a = document.createElement("a");
      a.href = data.url;
      a.download = filename;
      a.click();
      toast.success("Download started");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const deleteRecordedVideo = async (video: RecordedVideo) => {
    const ok = await confirm({
      title: "Delete this recording?",
      description: "This will permanently remove the video from storage. This action cannot be undone.",
      confirmLabel: "Delete recording",
    });
    if (!ok) return;

    try {
      // Extract filename from recording URL
      const url = new URL(video.recording_url);
      const pathname = url.pathname;
      const filename = pathname.split("/").pop() || "recording.m3u8";

      const { error: deleteError } = await supabase.functions.invoke("manage-s3-recordings", {
        body: {
          action: "delete",
          filename,
        },
      });
      if (deleteError) {
        toast.error("Failed to delete from storage");
        return;
      }
      const { error: dbError } = await supabase
        .from("live_classes")
        .update({ recording_url: null })
        .eq("id", video.id);

      if (dbError) {
        toast.error("Failed to update database");
        return;
      }

      toast.success("Recording deleted");
      loadRecordedVideos();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

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

  const { paged: paged, page, setPage, totalPages, total, pageSize } = usePagination(filtered, PAGE_SIZE);

  const filteredCoursesForForm = useMemo(() => {
    return courses.filter((c) => {
      if (form.target_exam) {
        const matchesExam = c.target?.toLowerCase() === form.target_exam.toLowerCase();
        if (!matchesExam) return false;
      }
      if (form.class) {
        const matchesClass = c.class?.toLowerCase() === form.class.toLowerCase();
        if (!matchesClass) return false;
      }
      return true;
    });
  }, [courses, form.target_exam, form.class]);

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
    const course = cls.course_id ? courses.find((c) => c.id === cls.course_id) : null;
    setForm({
      title: cls.title,
      subject: cls.subject,
      teacherId: cls.created_by ?? "",
      courseId: cls.course_id ?? "",
      starts_at: toLocalInput(cls.starts_at),
      duration_minutes: duration,
      description: cls.description ?? "",
      target_exam: course?.target || cls.target_exam || "",
      class: course?.class || "",
    });
    setShowForm(true);
  };

  // Duplicate an existing class — pre-fill form, blank start time
  const duplicateClass = (cls: AdminLive) => {
    const start = new Date(cls.starts_at).getTime();
    const end = cls.ends_at ? new Date(cls.ends_at).getTime() : start + 60 * 60 * 1000;
    const duration = Math.max(15, Math.round((end - start) / 60000));
    setEditingId(null);
    const course = cls.course_id ? courses.find((c) => c.id === cls.course_id) : null;
    setForm({
      title: cls.title,
      subject: cls.subject,
      teacherId: cls.created_by ?? "",
      courseId: cls.course_id ?? "",
      starts_at: "",
      duration_minutes: duration,
      description: cls.description ?? "",
      target_exam: course?.target || cls.target_exam || "",
      class: course?.class || "",
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
        const { data: inserted, error } = await supabase
          .from("live_classes")
          .insert({ ...payload, status: "scheduled" })
          .select("id, slug")
          .single();
        if (error) throw error;

        // Create Zoom meeting and persist credentials
        try {
          const { data: zoomRaw, error: zoomErr } = await supabase.functions.invoke("zoom-create-meeting", {
            body: {
              title: form.title,
              startTime: startsAt.toISOString(),
              durationMinutes: form.duration_minutes,
              teacherId: form.teacherId || undefined,
            },
          });
          const zoomData = zoomRaw as { meetingId?: string; password?: string } | null;
          if (!zoomErr && zoomData?.meetingId) {
            await supabase.from("live_classes").update({
              zoom_meeting_id: zoomData.meetingId,
              zoom_meeting_password: zoomData.password ?? "",
            }).eq("id", inserted.id);
          } else {
            console.warn("[Zoom] Meeting creation failed:", zoomErr?.message ?? "No meetingId returned");
            toast.warning("Class scheduled, but Zoom meeting could not be created automatically. Configure it in Zoom dashboard.");
          }
        } catch (zoomEx) {
          console.error("[Zoom] Exception:", zoomEx);
          toast.warning("Class scheduled, but Zoom meeting setup failed. You can retry from admin.");
        }

        toast.success("Live class scheduled");
      }
      closeForm();
      load();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to save class");
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

  const applyTemplate = (t: Template) => {
    setEditingId(null);
    setForm({
      title: t.title,
      subject: t.subject,
      teacherId: t.teacher_id ?? "",
      courseId: "",
      starts_at: "",
      duration_minutes: t.duration_minutes,
      description: t.description ?? "",
      target_exam: t.target_exam ?? "",
      class: "",
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


  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-[#0F1729] p-6 text-white">
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
            {activeTab === "live" && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#0F1729] hover:bg-white/90"
              >
                <Plus className="h-4 w-4" /> Schedule class
              </button>
            )}
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

      {/* Tab toggle */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "live"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Live Classes
        </button>
        <button
          onClick={() => {
            setActiveTab("recorded");
            loadRecordedVideos();
          }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "recorded"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recorded Content
        </button>
      </div>

      {activeTab === "live" ? (
        <>
          {/* Filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, subject or teacher…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-[1fr_1fr]">
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
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Educator</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Starts At</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((cls) => (
                      <tr key={cls.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{cls.title}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{cls.educator_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{cls.subject}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(cls.starts_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              statusColors[cls.status] ?? statusColors.scheduled
                            }`}
                          >
                            {cls.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
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
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                              title="Duplicate class"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(cls)}
                              className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                              title="Edit class"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(cls.id)}
                              className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete class"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <>
          {recordedLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : recordedVideos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No recorded videos yet. Recorded classes will appear here once they are available.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-4">
              <div className="inline-block min-w-full px-4 sm:px-6 lg:px-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-max sm:min-w-full">
                  {recordedVideos.map((video) => {
                    const url = new URL(video.recording_url);
                    const pathname = url.pathname;
                    const filename = pathname.split("/").pop() || "recording.m3u8";
                    return (
                      <div key={video.id} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col w-80 sm:w-auto">
                        {/* Video preview */}
                        <div className="bg-background aspect-video flex items-center justify-center relative group">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Video className="h-12 w-12 text-muted-foreground/60" />
                          </div>
                          <button
                            onClick={() => viewRecordedVideo(video)}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/80"
                            title="Preview video"
                          >
                            <Eye className="h-6 w-6 text-white" />
                          </button>
                        </div>

                        {/* Video details */}
                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="text-sm font-bold text-foreground truncate">{video.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{video.educator_name} · {video.subject}</p>
                          <p className="text-xs text-muted-foreground mt-2 truncate">{filename}</p>

                          {/* Action buttons */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => viewRecordedVideo(video)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                              title="View video"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                            <button
                              onClick={() => downloadRecordedVideo(video)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
                              title="Download video"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </button>
                            <button
                              onClick={() => deleteRecordedVideo(video)}
                              className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                              title="Delete video"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
                    setForm((f) => ({ ...f, title: newTitle }));
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
                  <select
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Select subject</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="English">English</option>
                    <option value="General">General</option>
                  </select>
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
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exam</label>
                  <select
                    value={form.target_exam}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        target_exam: val,
                        class: "",
                        courseId: ""
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Select exam</option>
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.name}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Class</label>
                  <select
                    value={form.class}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        class: val,
                        courseId: ""
                      }));
                    }}
                    disabled={!form.target_exam}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="">Select class</option>
                    {getClassesForExam(form.target_exam).map((clsOpt) => (
                      <option key={clsOpt} value={clsOpt}>
                        Class {clsOpt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Course (optional)</label>
                <select
                  value={form.courseId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const selectedCourse = courses.find((c) => c.id === val);
                    setForm((prev) => ({
                      ...prev,
                      courseId: val,
                      target_exam: selectedCourse?.target || prev.target_exam,
                      class: selectedCourse?.class || prev.class,
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">No course — standalone class</option>
                  {filteredCoursesForForm.map((c) => (
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
                        onClick={() => applyTemplate(t)}
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
