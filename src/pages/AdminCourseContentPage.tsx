import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { format } from "date-fns";
import {
  FileText, Upload, Loader2, Trash2, Eye, EyeOff, Search, BookOpen, ArrowLeft, Download, X,
  Plus, Video, Pencil, FolderPlus, GripVertical, CheckCircle2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type Course = { id: string; name: string; slug: string; subject: string; educator_name: string; thumbnail_url: string | null };
type Chapter = { id: string; title: string; position: number };
type Resource = {
  id: string;
  course_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_published: boolean;
  position: number;
  created_at: string;
};
type Lesson = {
  id: string;
  course_id: string;
  chapter_id: string;
  slug: string;
  title: string;
  position: number;
  duration_seconds: number;
  video_url: string | null;
  is_free_preview: boolean;
  type: string;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const chapterDragId = (id: string) => `chapter:${id}`;
const lessonDragId = (id: string) => `lesson:${id}`;
const parseDragId = (id: string) => {
  const [type, itemId] = id.split(":");
  return { type, itemId };
};

const SortableChapter = ({ chapter, children }: { chapter: Chapter; children: ReactNode }) => {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapterDragId(chapter.id),
  });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`p-4 ${isDragging ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
          title="Drag to reorder chapter"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  );
};

const SortableLecture = ({ lesson, children }: { lesson: Lesson; children: ReactNode }) => {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lessonDragId(lesson.id),
  });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2 ${isDragging ? "opacity-60" : ""}`}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
        title="Drag to reorder lecture"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </li>
  );
};


const RESOURCE_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "notes", label: "Notes" },
  { value: "worksheet", label: "Worksheet" },
  { value: "solution", label: "Solution" },
  { value: "other", label: "Other" },
];

const typeStyle: Record<string, string> = {
  pdf: "bg-destructive/15 text-destructive border-destructive/30",
  notes: "bg-primary/15 text-primary border-primary/30",
  worksheet: "bg-secondary/15 text-secondary border-secondary/30",
  solution: "bg-accent/15 text-accent-foreground border-accent/30",
  other: "bg-muted text-muted-foreground border-border",
};

const uploadSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  resource_type: z.enum(["pdf", "notes", "worksheet", "solution", "other"]),
  chapter_id: z.string().optional(),
});

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const formatSize = (b: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const AdminCourseContentPage = () => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    resource_type: "pdf" as "pdf" | "notes" | "worksheet" | "solution" | "other",
    chapter_id: "none",
    is_published: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [savingChapter, setSavingChapter] = useState(false);

  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [lectureForm, setLectureForm] = useState({
    title: "",
    durationMin: 10,
    chapter_id: "",
    is_free_preview: false,
    uploadedKey: null as string | null,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [savingLecture, setSavingLecture] = useState(false);
  const [reordering, setReordering] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Load courses
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name,slug,subject,educator_name,thumbnail_url")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setCourses((data as Course[]) ?? []);
      setCoursesLoading(false);
    })();
  }, []);

  // Load chapters + lessons + resources when a course is selected
  const loadCourseDetail = async (courseId: string) => {
    setResLoading(true);
    const [{ data: ch }, { data: ls }, { data: rs }] = await Promise.all([
      supabase.from("chapters").select("id,title,position").eq("course_id", courseId).order("position"),
      supabase.from("lessons").select("id,course_id,chapter_id,slug,title,position,duration_seconds,video_url,is_free_preview,type").eq("course_id", courseId).order("position"),
      supabase.from("course_resources").select("*").eq("course_id", courseId).order("created_at", { ascending: false }),
    ]);
    setChapters((ch as Chapter[]) ?? []);
    setLessons((ls as Lesson[]) ?? []);
    setResources((rs as Resource[]) ?? []);
    setResLoading(false);
  };

  useEffect(() => {
    if (selectedCourse) loadCourseDetail(selectedCourse.id);
    else { setChapters([]); setLessons([]); setResources([]); setChapterFilter("all"); }
  }, [selectedCourse]);

  const resetLectureDialog = () => {
    setVideoFile(null);
    setUploadProgress(0);
    setUploadState("idle");
  };

  const openAddLecture = (chapterId: string) => {
    setEditingLessonId(null);
    setLectureForm({ title: "", durationMin: 10, chapter_id: chapterId, is_free_preview: false, uploadedKey: null });
    resetLectureDialog();
    setLectureDialogOpen(true);
  };

  const openEditLecture = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setLectureForm({
      title: lesson.title,
      durationMin: Math.max(1, Math.round((lesson.duration_seconds || 0) / 60)),
      chapter_id: lesson.chapter_id,
      is_free_preview: lesson.is_free_preview,
      uploadedKey: lesson.video_url,
    });
    resetLectureDialog();
    setLectureDialogOpen(true);
  };

  const handleVideoFileSelected = (file: File) => {
    setVideoFile(file);
    setUploadState("idle");
    setUploadProgress(0);
    // Auto-read duration from the video metadata
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (isFinite(vid.duration) && vid.duration > 0) {
        setLectureForm((f) => ({ ...f, durationMin: Math.max(1, Math.round(vid.duration / 60)) }));
      }
    };
    vid.src = url;
  };

  const uploadVideoToS3 = async (lessonId: string, file: File): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("get-upload-url", {
      body: { lessonId, contentType: file.type || "video/mp4", contentLength: file.size },
    });
    if (error || !data?.uploadUrl) throw new Error(error?.message ?? "Failed to get upload URL");

    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data.key as string);
        } else {
          reject(new Error(`Upload failed: HTTP ${xhr.status} — ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("PUT", data.uploadUrl);
      // Set all signed headers returned by the edge function
      Object.entries(data.headers as Record<string, string>).forEach(([k, v]) => {
        xhr.setRequestHeader(k, v);
      });
      xhr.send(file);
    });
  };

  const saveChapter = async () => {
    if (!selectedCourse) return;
    const title = chapterTitle.trim();
    if (!title) { toast.error("Chapter title is required"); return; }
    setSavingChapter(true);
    const nextPos = chapters.length;
    const { error } = await supabase.from("chapters").insert({
      course_id: selectedCourse.id, title, position: nextPos,
    });
    setSavingChapter(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chapter added");
    setChapterDialogOpen(false);
    setChapterTitle("");
    loadCourseDetail(selectedCourse.id);
  };

  const saveLecture = async () => {
    if (!selectedCourse) return;
    const title = lectureForm.title.trim();
    if (!title) { toast.error("Lecture title is required"); return; }
    if (!lectureForm.chapter_id) { toast.error("Pick a chapter"); return; }
    const durationSecs = Math.max(60, Math.round((lectureForm.durationMin || 10) * 60));

    setSavingLecture(true);
    try {
      let videoKey = lectureForm.uploadedKey;

      // Upload new video file if one was selected
      if (videoFile) {
        setUploadState("uploading");
        setUploadProgress(0);
        const lessonId = editingLessonId ?? crypto.randomUUID();
        videoKey = await uploadVideoToS3(lessonId, videoFile);
        setUploadState("done");
        setLectureForm((f) => ({ ...f, uploadedKey: videoKey }));

        if (editingLessonId) {
          const currentLesson = lessons.find((lesson) => lesson.id === editingLessonId);
          const movedToNewChapter = currentLesson?.chapter_id !== lectureForm.chapter_id;
          const nextPosition = movedToNewChapter
            ? Math.max(-1, ...lessons.filter((lesson) => lesson.chapter_id === lectureForm.chapter_id).map((lesson) => lesson.position)) + 1
            : currentLesson?.position ?? 0;
          const { error } = await supabase
            .from("lessons")
            .update({
              title,
              video_url: videoKey,
              duration_seconds: durationSecs,
              chapter_id: lectureForm.chapter_id,
              position: nextPosition,
              is_free_preview: lectureForm.is_free_preview,
            })
            .eq("id", editingLessonId);
          if (error) throw error;
          toast.success("Lecture updated");
        } else {
          const positionInChapter = Math.max(-1, ...lessons.filter((l) => l.chapter_id === lectureForm.chapter_id).map((l) => l.position)) + 1;
          const slug = `${slugify(title) || "lesson"}-${Date.now().toString(36)}`;
          const { error } = await supabase.from("lessons").insert({
            id: lessonId,
            course_id: selectedCourse.id,
            chapter_id: lectureForm.chapter_id,
            title,
            slug,
            position: positionInChapter,
            duration_seconds: durationSecs,
            video_url: videoKey,
            is_free_preview: lectureForm.is_free_preview,
            type: "video",
          });
          if (error) throw error;
          toast.success("Lecture added");
        }
      } else if (editingLessonId) {
        // No new video — just update metadata
        const currentLesson = lessons.find((lesson) => lesson.id === editingLessonId);
        const movedToNewChapter = currentLesson?.chapter_id !== lectureForm.chapter_id;
        const nextPosition = movedToNewChapter
          ? Math.max(-1, ...lessons.filter((lesson) => lesson.chapter_id === lectureForm.chapter_id).map((lesson) => lesson.position)) + 1
          : currentLesson?.position ?? 0;
        const { error } = await supabase
          .from("lessons")
          .update({
            title,
            duration_seconds: durationSecs,
            chapter_id: lectureForm.chapter_id,
            position: nextPosition,
            is_free_preview: lectureForm.is_free_preview,
          })
          .eq("id", editingLessonId);
        if (error) throw error;
        toast.success("Lecture updated");
      } else {
        // New lecture with no video yet
        const lessonId = crypto.randomUUID();
        const positionInChapter = Math.max(-1, ...lessons.filter((l) => l.chapter_id === lectureForm.chapter_id).map((l) => l.position)) + 1;
        const slug = `${slugify(title) || "lesson"}-${Date.now().toString(36)}`;
        const { error } = await supabase.from("lessons").insert({
          id: lessonId,
          course_id: selectedCourse.id,
          chapter_id: lectureForm.chapter_id,
          title,
          slug,
          position: positionInChapter,
          duration_seconds: durationSecs,
          video_url: null,
          is_free_preview: lectureForm.is_free_preview,
          type: "video",
        });
        if (error) throw error;
        toast.success("Lecture added (no video yet — edit to upload one)");
      }
    } catch (e) {
      setUploadState("error");
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
      setSavingLecture(false);
      return;
    }

    setSavingLecture(false);

    // Recompute course totals
    const { data: allLessons } = await supabase
      .from("lessons")
      .select("duration_seconds")
      .eq("course_id", selectedCourse.id);
    const totalSecs = (allLessons ?? []).reduce((s, l) => s + (l.duration_seconds || 0), 0);
    await supabase
      .from("courses")
      .update({
        total_lessons: (allLessons ?? []).length,
        duration_hours: Math.max(1, Math.round(totalSecs / 3600)),
      })
      .eq("id", selectedCourse.id);

    setLectureDialogOpen(false);
    loadCourseDetail(selectedCourse.id);
  };

  const persistChapterOrder = async (orderedChapters: Chapter[]) => {
    const updates = orderedChapters.map((ch, index) =>
      supabase.from("chapters").update({ position: index }).eq("id", ch.id),
    );
    const results = await Promise.all(updates);
    return results.find((r) => r.error)?.error ?? null;
  };

  const persistLessonOrder = async (orderedLessons: Lesson[], chapterId: string) => {
    const updates = orderedLessons.map((lesson, index) =>
      supabase.from("lessons").update({ chapter_id: chapterId, position: index }).eq("id", lesson.id),
    );
    const results = await Promise.all(updates);
    return results.find((r) => r.error)?.error ?? null;
  };

  const handleCurriculumDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!selectedCourse || !over || active.id === over.id) return;
    const activeMeta = parseDragId(String(active.id));
    const overMeta = parseDragId(String(over.id));
    if (activeMeta.type !== overMeta.type) return;

    if (activeMeta.type === "chapter") {
      const oldIndex = chapters.findIndex((ch) => ch.id === activeMeta.itemId);
      const newIndex = chapters.findIndex((ch) => ch.id === overMeta.itemId);
      if (oldIndex < 0 || newIndex < 0) return;
      const previous = chapters;
      const next = arrayMove(chapters, oldIndex, newIndex).map((ch, index) => ({ ...ch, position: index }));
      setChapters(next);
      setReordering(true);
      const error = await persistChapterOrder(next);
      setReordering(false);
      if (error) {
        setChapters(previous);
        toast.error(error.message);
        return;
      }
      toast.success("Chapter order updated");
      return;
    }

    if (activeMeta.type === "lesson") {
      const activeLesson = lessons.find((lesson) => lesson.id === activeMeta.itemId);
      const overLesson = lessons.find((lesson) => lesson.id === overMeta.itemId);
      if (!activeLesson || !overLesson || activeLesson.chapter_id !== overLesson.chapter_id) return;

      const chapterLessons = lessons
        .filter((lesson) => lesson.chapter_id === activeLesson.chapter_id)
        .sort((a, b) => a.position - b.position);
      const oldIndex = chapterLessons.findIndex((lesson) => lesson.id === activeLesson.id);
      const newIndex = chapterLessons.findIndex((lesson) => lesson.id === overLesson.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const previous = lessons;
      const nextChapterLessons = arrayMove(chapterLessons, oldIndex, newIndex).map((lesson, index) => ({ ...lesson, position: index }));
      setLessons((current) =>
        current.map((lesson) => nextChapterLessons.find((updated) => updated.id === lesson.id) ?? lesson),
      );
      setReordering(true);
      const error = await persistLessonOrder(nextChapterLessons, activeLesson.chapter_id);
      setReordering(false);
      if (error) {
        setLessons(previous);
        toast.error(error.message);
        return;
      }
      toast.success("Lecture order updated");
    }
  };

  const deleteLesson = async (lesson: Lesson) => {
    const ok = await confirm({
      title: `Delete "${lesson.title}"?`,
      description: "Students will lose access to this lecture. This cannot be undone.",
      confirmLabel: "Delete lecture",
    });
    if (!ok) return;
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lecture deleted");
    if (selectedCourse) loadCourseDetail(selectedCourse.id);
  };

  const deleteChapter = async (ch: Chapter) => {
    const lessonsInChapter = lessons.filter((l) => l.chapter_id === ch.id).length;
    const ok = await confirm({
      title: `Delete chapter "${ch.title}"?`,
      description: lessonsInChapter > 0
        ? `This chapter has ${lessonsInChapter} lecture(s) which will also be removed.`
        : "This chapter will be removed.",
      confirmLabel: "Delete chapter",
    });
    if (!ok) return;
    await supabase.from("lessons").delete().eq("chapter_id", ch.id);
    const { error } = await supabase.from("chapters").delete().eq("id", ch.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chapter deleted");
    if (selectedCourse) loadCourseDetail(selectedCourse.id);
  };


  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.educator_name.toLowerCase().includes(q)
    );
  }, [courses, search]);
  const { paged: pagedCourses, page: coursePage, setPage: setCoursePage, totalPages: courseTotalPages, total: courseTotal, pageSize: coursePageSize } = usePagination(filteredCourses, 15);

  const visibleResources = useMemo(() => {
    if (chapterFilter === "all") return resources;
    if (chapterFilter === "none") return resources.filter((r) => !r.chapter_id);
    return resources.filter((r) => r.chapter_id === chapterFilter);
  }, [resources, chapterFilter]);

  const handleUpload = async () => {
    if (!selectedCourse) return;
    const parsed = uploadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!file) {
      toast.error("Please choose a file");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File must be under 25 MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${selectedCourse.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("course-resources")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("course-resources").getPublicUrl(path);

      const { error: insErr } = await supabase.from("course_resources").insert({
        course_id: selectedCourse.id,
        chapter_id: form.chapter_id === "none" ? null : form.chapter_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        resource_type: form.resource_type,
        file_url: pub.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        is_published: form.is_published,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Resource uploaded");
      setDialogOpen(false);
      setForm({ title: "", description: "", resource_type: "pdf", chapter_id: "none", is_published: true });
      setFile(null);
      loadCourseDetail(selectedCourse.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const togglePublish = async (r: Resource) => {
    if (r.is_published) {
      const ok = await confirm({
        title: `Unpublish "${r.title}"?`,
        description: "Students will lose access to this resource until it's republished.",
        confirmLabel: "Unpublish resource",
      });
      if (!ok) return;
    }
    const { error } = await supabase
      .from("course_resources")
      .update({ is_published: !r.is_published })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setResources((prev) => prev.map((x) => x.id === r.id ? { ...x, is_published: !r.is_published } : x));
  };

  const deleteResource = async (r: Resource) => {
    const ok = await confirm({
      title: `Delete "${r.title}"?`,
      description: "This resource will be removed from the course and students will no longer be able to access it. This action cannot be undone.",
      confirmLabel: "Delete resource",
    });
    if (!ok) return;
    const { error } = await supabase.from("course_resources").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setResources((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Resource deleted");
  };

  // ------------- View: Course list -------------
  if (!selectedCourse) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {ConfirmDialog}
        <div>
          <h1 className="text-2xl font-black font-display text-foreground">Course Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a course to upload PDFs, notes, worksheets and other learning material.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by course, subject or educator"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {coursesLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-semibold text-foreground">No courses found</p>
            </div>
          ) : (
            <>
            <ul className="divide-y divide-border">
              {pagedCourses.map((c) => (
                <li
                  key={c.id}
                  className="flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedCourse(c)}
                >
                  <div className="h-12 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.subject} · {c.educator_name}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Manage content</Button>
                </li>
              ))}
            </ul>
            <TablePagination page={coursePage} totalPages={courseTotalPages} total={courseTotal} pageSize={coursePageSize} onPageChange={setCoursePage} />
            </>
          )}
        </div>
      </div>
    );
  }

  // ------------- View: Selected course -------------
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {ConfirmDialog}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => setSelectedCourse(null)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-black font-display text-foreground truncate">{selectedCourse.name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {selectedCourse.subject} · {selectedCourse.educator_name}
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Upload className="h-4 w-4" /> Upload resource
        </Button>
      </div>

      {/* Curriculum */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Curriculum <span className="text-muted-foreground font-normal">({lessons.length} lectures · {chapters.length} chapters)</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add lectures by uploading MP4 video files. Videos are stored securely and only accessible to paying students.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setChapterTitle(""); setChapterDialogOpen(true); }}>
              <FolderPlus className="h-4 w-4" /> Add chapter
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (chapters.length === 0) { toast.error("Add a chapter first"); return; }
                openAddLecture(chapters[0].id);
              }}
            >
              <Plus className="h-4 w-4" /> Add lectures
            </Button>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="p-12 text-center">
            <Video className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold text-foreground">No chapters yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a chapter, then start adding lectures.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCurriculumDragEnd}>
            <SortableContext items={chapters.map((ch) => chapterDragId(ch.id))} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border">
                {chapters.map((ch) => {
                  const chLessons = lessons
                    .filter((l) => l.chapter_id === ch.id)
                    .sort((a, b) => a.position - b.position);
                  return (
                    <SortableChapter key={ch.id} chapter={ch}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{ch.title}</p>
                          <p className="text-xs text-muted-foreground">{chLessons.length} lecture{chLessons.length === 1 ? "" : "s"}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {reordering && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <Button size="sm" variant="outline" onClick={() => openAddLecture(ch.id)}>
                            <Plus className="h-3.5 w-3.5" /> Add lecture
                          </Button>
                          <button
                            onClick={() => deleteChapter(ch)}
                            className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete chapter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {chLessons.length > 0 && (
                        <SortableContext items={chLessons.map((lec) => lessonDragId(lec.id))} strategy={verticalListSortingStrategy}>
                          <ul className="mt-3 ml-2 space-y-1.5 border-l border-border pl-4">
                            {chLessons.map((lec) => (
                              <SortableLecture key={lec.id} lesson={lec}>
                                <Video className="h-4 w-4 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground truncate">{lec.title}</p>
                                    {lec.is_free_preview && <Badge variant="outline" className="text-[10px]">Free preview</Badge>}
                                    {lec.video_url && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" title="Video uploaded" />}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {Math.max(1, Math.round((lec.duration_seconds || 0) / 60))} min
                                    {!lec.video_url && " · no video yet"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => openEditLecture(lec)}
                                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteLesson(lec)}
                                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </SortableLecture>
                            ))}
                          </ul>
                        </SortableContext>
                      )}
                    </SortableChapter>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-foreground">
            Resources <span className="text-muted-foreground font-normal">({resources.length})</span>
          </h2>
          <Select value={chapterFilter} onValueChange={setChapterFilter}>
            <SelectTrigger className="w-full md:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              <SelectItem value="none">No chapter</SelectItem>
              {chapters.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {resLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : visibleResources.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold text-foreground">No resources yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload your first PDF or notes for this course.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visibleResources.map((r) => {
              const chapter = chapters.find((c) => c.id === r.chapter_id);
              return (
                <li key={r.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground truncate">{r.title}</p>
                      <Badge variant="outline" className={`text-[10px] uppercase ${typeStyle[r.resource_type]}`}>
                        {r.resource_type}
                      </Badge>
                      {!r.is_published && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {chapter ? `${chapter.title} · ` : ""}{formatSize(r.file_size_bytes)} · {format(new Date(r.created_at), "dd MMM")}
                    </p>
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => togglePublish(r)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
                      title={r.is_published ? "Unpublish" : "Publish"}
                    >
                      {r.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteResource(r)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 3 — Notes (Kinematics)"
              />
            </div>
            <div>
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.resource_type}
                  onValueChange={(v) => setForm({ ...form, resource_type: v as typeof form.resource_type })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chapter (optional)</Label>
                <Select
                  value={form.chapter_id}
                  onValueChange={(v) => setForm({ ...form, chapter_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No chapter</SelectItem>
                    {chapters.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="file">File (PDF, DOC, image — max 25 MB)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} · {formatSize(file.size)}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Publish immediately</p>
                <p className="text-xs text-muted-foreground">Visible to students of this course</p>
              </div>
              <Switch
                checked={form.is_published}
                onCheckedChange={(v) => setForm({ ...form, is_published: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Chapter Dialog */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add chapter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="ch-title">Chapter title</Label>
            <Input
              id="ch-title"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="e.g. Kinematics"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveChapter} disabled={savingChapter}>
              {savingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              Add chapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Lecture Dialog */}
      <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLessonId ? "Edit lecture" : "Add lecture"}</DialogTitle>
            <DialogDescription>
              Upload an MP4 video file. The duration is read automatically from the file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lec-title">Lecture title</Label>
              <Input
                id="lec-title"
                value={lectureForm.title}
                onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })}
                placeholder="e.g. Newton's Laws of Motion"
              />
            </div>
            <div>
              <Label htmlFor="lec-video">Video file (MP4)</Label>
              <Input
                id="lec-video"
                type="file"
                accept="video/mp4,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleVideoFileSelected(f);
                }}
              />
              {videoFile && uploadState === "idle" && (
                <p className="mt-1 text-xs text-muted-foreground">{videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
              )}
              {uploadState === "uploading" && (
                <div className="mt-2 space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
                </div>
              )}
              {uploadState === "done" && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Upload complete
                </p>
              )}
              {uploadState === "error" && (
                <p className="mt-1 text-xs text-destructive">Upload failed — try again.</p>
              )}
              {!videoFile && lectureForm.uploadedKey && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Video already uploaded
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lec-dur">Duration (minutes)</Label>
                <Input
                  id="lec-dur"
                  type="number"
                  min={1}
                  value={lectureForm.durationMin}
                  onChange={(e) => setLectureForm({ ...lectureForm, durationMin: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Chapter</Label>
                <Select
                  value={lectureForm.chapter_id}
                  onValueChange={(v) => setLectureForm({ ...lectureForm, chapter_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Choose chapter" /></SelectTrigger>
                  <SelectContent>
                    {chapters.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Free preview</p>
                <p className="text-xs text-muted-foreground">Anyone can watch without enrolling</p>
              </div>
              <Switch
                checked={lectureForm.is_free_preview}
                onCheckedChange={(v) => setLectureForm({ ...lectureForm, is_free_preview: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLectureDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLecture} disabled={savingLecture || uploadState === "uploading"}>
              {savingLecture ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingLessonId ? "Save changes" : "Add lecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminCourseContentPage;
