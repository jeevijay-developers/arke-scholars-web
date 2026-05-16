import { useEffect, useState } from "react";
import { Plus, GripVertical, Trash2, Upload, Video, IndianRupee, Loader2, X } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useExams } from "@/hooks/useExams";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

type DraftLecture = { id?: string; title: string; durationMin: number };
type DraftChapter = { id?: string; title: string; lectures: DraftLecture[] };

const CreateCoursePage = () => {
  const { examNames } = useExams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const location = useLocation();
  const isAdminContext = location.pathname.startsWith("/admin");
  const isEditMode = Boolean(courseId);

  const [name, setName] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [exam, setExam] = useState("JEE");
  const [subject, setSubject] = useState("Physics");
  const [educatorName, setEducatorName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [chapters, setChapters] = useState<DraftChapter[]>([
    { title: "Chapter 1", lectures: [{ title: "Introduction", durationMin: 15 }] },
  ]);
  const [learnItems, setLearnItems] = useState<string[]>([]);
  const [learnInput, setLearnInput] = useState("");
  const [reqItems, setReqItems] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState("");

  // Load existing course in edit mode
  useEffect(() => {
    if (!isEditMode || !courseId) return;
    const load = async () => {
      setLoading(true);
      const { data: course, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .maybeSingle();
      if (error || !course) {
        toast.error("Course not found");
        setLoading(false);
        return;
      }
      setName(course.name ?? "");
      setShortDesc("");
      setDescription(course.description ?? "");
      setExam(course.target_exam ?? "JEE");
      setSubject(course.subject ?? "Physics");
      setEducatorName(course.educator_name ?? "");
      setPrice(Number(course.price ?? 0));
      setOriginalPrice(Number(course.original_price ?? 0));
      setExistingThumbnail(course.thumbnail_url ?? null);
      setLearnItems((course.what_youll_learn ?? []) as string[]);
      setReqItems((course.requirements ?? []) as string[]);

      const { data: chs } = await supabase
        .from("chapters")
        .select("id, title, position")
        .eq("course_id", courseId)
        .order("position");
      const chapterIds = (chs ?? []).map((c) => c.id);
      const { data: lessons } = chapterIds.length
        ? await supabase
            .from("lessons")
            .select("id, chapter_id, title, position, duration_seconds")
            .in("chapter_id", chapterIds)
            .order("position")
        : { data: [] as { id: string; chapter_id: string; title: string; position: number; duration_seconds: number }[] };
      const grouped: DraftChapter[] = (chs ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        lectures: (lessons ?? [])
          .filter((l) => l.chapter_id === c.id)
          .map((l) => ({ id: l.id, title: l.title, durationMin: Math.max(1, Math.round(l.duration_seconds / 60)) })),
      }));
      if (grouped.length) setChapters(grouped);
      setLoading(false);
    };
    load();
  }, [isEditMode, courseId]);

  const addLearn = () => {
    const v = learnInput.trim();
    if (!v) return;
    setLearnItems([...learnItems, v]);
    setLearnInput("");
  };
  const addReq = () => {
    const v = reqInput.trim();
    if (!v) return;
    setReqItems([...reqItems, v]);
    setReqInput("");
  };

  const addChapter = () => setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, lectures: [] }]);
  const removeChapter = (i: number) => setChapters(chapters.filter((_, j) => j !== i));
  const addLecture = (ci: number) => {
    const c = [...chapters];
    c[ci].lectures.push({ title: "New lecture", durationMin: 10 });
    setChapters(c);
  };
  const removeLecture = (ci: number, li: number) => {
    const c = [...chapters];
    c[ci].lectures.splice(li, 1);
    setChapters(c);
  };

  const submit = async (publish: boolean) => {
    if (!user) return toast.error("Please sign in");
    if (!name.trim()) return toast.error("Course title is required");
    if (isEditMode && chapters.length === 0) return toast.error("Add at least one chapter");

    setSubmitting(true);

    let thumbnailUrl: string | null = existingThumbnail;
    if (thumbnailFile) {
      const path = `${user.id}/${Date.now()}-${thumbnailFile.name}`;
      const { error: upErr } = await supabase.storage.from("educator-uploads").upload(path, thumbnailFile);
      if (upErr) {
        toast.error("Thumbnail upload failed");
        setSubmitting(false);
        return;
      }
      thumbnailUrl = supabase.storage.from("educator-uploads").getPublicUrl(path).data.publicUrl;
    }

    const resolvedEducatorName =
      educatorName.trim() ||
      ((user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Educator").trim();

    let workingCourseId = courseId;

    if (!isEditMode) {
      const baseSlug = slugify(name) || `course-${Date.now()}`;
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const { data: course, error: courseErr } = await supabase
        .from("courses")
        .insert({
          name,
          slug,
          description: description || shortDesc,
          subject,
          target_exam: exam,
          educator_name: resolvedEducatorName,
          price,
          original_price: originalPrice || null,
          discount_percent: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
          thumbnail_url: thumbnailUrl,
          is_published: publish,
          created_by: user.id,
          what_youll_learn: learnItems,
          requirements: reqItems,
        })
        .select("id, slug")
        .single();

      if (courseErr || !course) {
        console.error(courseErr);
        toast.error(courseErr?.message ?? "Could not create course");
        setSubmitting(false);
        return;
      }
      workingCourseId = course.id;
    } else {
      const { error: updErr } = await supabase
        .from("courses")
        .update({
          name,
          description: description || shortDesc,
          subject,
          target_exam: exam,
          educator_name: resolvedEducatorName,
          price,
          original_price: originalPrice || null,
          discount_percent: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
          thumbnail_url: thumbnailUrl,
          is_published: publish,
          what_youll_learn: learnItems,
          requirements: reqItems,
        })
        .eq("id", courseId!);
      if (updErr) {
        toast.error(updErr.message);
        setSubmitting(false);
        return;
      }
    }

    if (!workingCourseId) {
      setSubmitting(false);
      return;
    }

    // Curriculum (chapters + lessons) is only managed during edit; on create,
    // admins build the curriculum afterwards from the Course Content page.
    if (isEditMode) {
      const { data: oldChs } = await supabase.from("chapters").select("id").eq("course_id", workingCourseId);
      const oldIds = (oldChs ?? []).map((c) => c.id);
      if (oldIds.length) {
        await supabase.from("lessons").delete().in("chapter_id", oldIds);
        await supabase.from("chapters").delete().in("id", oldIds);
      }

      let totalSecs = 0;
      let totalLessons = 0;
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        const { data: chapterRow, error: chapterErr } = await supabase
          .from("chapters")
          .insert({ course_id: workingCourseId, title: ch.title || `Chapter ${ci + 1}`, position: ci })
          .select("id")
          .single();
        if (chapterErr || !chapterRow) {
          toast.error("Failed creating chapter");
          setSubmitting(false);
          return;
        }
        const lessonRows = ch.lectures.map((l, li) => ({
          course_id: workingCourseId!,
          chapter_id: chapterRow.id,
          slug: `${ci}-${li}-${slugify(l.title) || "lesson"}`,
          title: l.title || `Lesson ${li + 1}`,
          position: li,
          duration_seconds: Math.max(60, l.durationMin * 60),
          is_free_preview: ci === 0 && li === 0,
          type: "video",
        }));
        lessonRows.forEach((l) => {
          totalSecs += l.duration_seconds;
          totalLessons += 1;
        });
        if (lessonRows.length) {
          await supabase.from("lessons").insert(lessonRows);
        }
      }

      await supabase
        .from("courses")
        .update({ total_lessons: totalLessons, duration_hours: Math.max(1, Math.round(totalSecs / 3600)) })
        .eq("id", workingCourseId);
    }

    toast.success(isEditMode ? "Course updated" : publish ? "Course published!" : "Draft saved");
    setSubmitting(false);
    navigate(isAdminContext ? "/admin/courses" : "/teacher/courses");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 pb-24 lg:pb-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">{isEditMode ? "Edit Course" : "Create New Course"}</h1>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Basic Information</h2>
        <div>
          <label className="text-xs font-semibold text-foreground">Course Title</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="e.g. JEE Physics Booster 2027"
          />
        </div>
        {!isEditMode && (
          <div>
            <label className="text-xs font-semibold text-foreground">Short Description</label>
            <input
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              maxLength={150}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              placeholder="150 chars max"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-foreground">Full Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none"
            placeholder="Detailed course description..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground">Exam</label>
            <select value={exam} onChange={(e) => setExam(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
              {examNames.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
              <option>Physics</option>
              <option>Chemistry</option>
              <option>Maths</option>
              <option>Biology</option>
            </select>
          </div>
        </div>
        {isAdminContext && (
          <div>
            <label className="text-xs font-semibold text-foreground">Educator Name</label>
            <input
              value={educatorName}
              onChange={(e) => setEducatorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="e.g. Vikram Thapar"
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Thumbnail</h2>
        {existingThumbnail && !thumbnailFile && (
          <img src={existingThumbnail} alt="Current thumbnail" className="h-32 w-auto rounded-lg border border-border object-cover" />
        )}
        <label className="block">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} />
          <div className="rounded-lg border-2 border-dashed border-border bg-background p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">{thumbnailFile ? thumbnailFile.name : existingThumbnail ? "Click to replace thumbnail" : "Click to upload thumbnail"}</p>
          </div>
        </label>
      </div>

      {isEditMode && (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Curriculum</h2>
          <button onClick={addChapter} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <Plus className="h-3 w-3" /> Add Chapter
          </button>
        </div>

        <div className="space-y-3">
          {chapters.map((ch, ci) => (
            <div key={ci} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  value={ch.title}
                  onChange={(e) => {
                    const c = [...chapters];
                    c[ci].title = e.target.value;
                    setChapters(c);
                  }}
                  className="flex-1 text-sm font-semibold bg-transparent outline-none text-foreground"
                  placeholder="Chapter title"
                />
                <Trash2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-destructive shrink-0" onClick={() => removeChapter(ci)} />
              </div>
              <div className="ml-6 space-y-1.5">
                {ch.lectures.map((lec, li) => (
                  <div key={li} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs">
                    <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                    <input
                      value={lec.title}
                      onChange={(e) => {
                        const c = [...chapters];
                        c[ci].lectures[li].title = e.target.value;
                        setChapters(c);
                      }}
                      className="flex-1 bg-transparent outline-none text-foreground"
                      placeholder="Lecture title"
                    />
                    <input
                      type="number"
                      value={lec.durationMin}
                      onChange={(e) => {
                        const c = [...chapters];
                        c[ci].lectures[li].durationMin = Number(e.target.value) || 0;
                        setChapters(c);
                      }}
                      className="w-14 bg-transparent outline-none text-muted-foreground text-right"
                    />
                    <span className="text-muted-foreground">min</span>
                    <Trash2 className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-destructive" onClick={() => removeLecture(ci, li)} />
                  </div>
                ))}
                <button onClick={() => addLecture(ci)} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline ml-1">
                  <Plus className="h-3 w-3" /> Add Lecture
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}


      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">What You'll Learn</h2>
        <p className="text-xs text-muted-foreground">Add learning outcomes students will gain from this course.</p>
        <div className="flex gap-2">
          <input
            value={learnInput}
            onChange={(e) => setLearnInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLearn(); } }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="e.g. Core fundamentals and theory"
          />
          <button type="button" onClick={addLearn} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {learnItems.length > 0 && (
          <ul className="space-y-1.5">
            {learnItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm text-foreground">
                <span className="flex items-start gap-2"><span className="text-muted-foreground">—</span>{item}</span>
                <button type="button" onClick={() => setLearnItems(learnItems.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Requirements</h2>
        <p className="text-xs text-muted-foreground">Add prerequisites or things students should know before starting.</p>
        <div className="flex gap-2">
          <input
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReq(); } }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="e.g. Basic algebra and calculus"
          />
          <button type="button" onClick={addReq} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {reqItems.length > 0 && (
          <ul className="space-y-1.5">
            {reqItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm text-foreground">
                <span className="flex items-start gap-2"><span className="text-muted-foreground">—</span>{item}</span>
                <button type="button" onClick={() => setReqItems(reqItems.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground">Pricing</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground">Price</label>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-background">
              <IndianRupee className="h-4 w-4 text-muted-foreground ml-3" />
              <input
                type="number"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                placeholder="1300"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Original Price (optional)</label>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-background">
              <IndianRupee className="h-4 w-4 text-muted-foreground ml-3" />
              <input
                type="number"
                value={originalPrice || ""}
                onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                placeholder="2500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          disabled={submitting}
          onClick={() => submit(false)}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : isEditMode ? "Save as Draft" : "Save Draft"}
        </button>
        <button
          disabled={submitting}
          onClick={() => submit(true)}
          className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : isEditMode ? "Save & Publish" : "Publish Course"}
        </button>
      </div>
    </div>
  );
};

export default CreateCoursePage;
