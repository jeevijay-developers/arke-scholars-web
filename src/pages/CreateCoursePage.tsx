import { useEffect, useState } from "react";
import { Upload, IndianRupee, Loader2, X, Tag } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import RichTextEditor from "@/components/RichTextEditor";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const TARGET_OPTIONS = ["JEE", "NEET", "Foundation"] as const;
const BADGE_OPTIONS = ["Bestseller", "Hot", "New Launch"] as const;

const CLASS_OPTIONS_BY_TARGET: Record<string, { label: string; value: string }[]> = {
  JEE:        [{ label: "Class 11", value: "11" }, { label: "Class 12", value: "12" }],
  NEET:       [{ label: "Class 11", value: "11" }, { label: "Class 12", value: "12" }],
  Foundation: [{ label: "Class 8", value: "8" }, { label: "Class 9", value: "9" }, { label: "Class 10", value: "10" }],
};

const DEFAULT_CLASS: Record<string, string> = {
  JEE: "11", NEET: "11", Foundation: "8",
};

const CreateCoursePage = () => {
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const isEditMode = Boolean(courseId);

  // ── Basic Info ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [internalName, setInternalName] = useState("");
  const [description, setDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [language, setLanguage] = useState<"Hinglish" | "English">("Hinglish");

  // ── Targeting ───────────────────────────────────────────────────────────────
  const [target, setTarget] = useState<string>("JEE");
  const [selectedClass, setSelectedClass] = useState<string>("11");
  const [courseEndDate, setCourseEndDate] = useState("");

  // ── Pricing ─────────────────────────────────────────────────────────────────
  const [isCourseFree, setIsCourseFree] = useState(false);
  const [mrp, setMrp] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [showPriceWithGst, setShowPriceWithGst] = useState(false);
  const [maxUsageDays, setMaxUsageDays] = useState<number | "">("");

  // ── Publishing ──────────────────────────────────────────────────────────────
  const [isActive, setIsActive] = useState(false);
  const [priority, setPriority] = useState<number>(0);

  const [badge, setBadge] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");


  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);

  const discountPercent =
    !isCourseFree && mrp > 0 && salePrice < mrp
      ? Math.round(((mrp - salePrice) / mrp) * 100)
      : 0;

  const availableClasses = CLASS_OPTIONS_BY_TARGET[target] ?? CLASS_OPTIONS_BY_TARGET.JEE;

  // Reset selectedClass when target changes (keep selection if still valid)
  useEffect(() => {
    const valid = availableClasses.some((c) => c.value === selectedClass);
    if (!valid) setSelectedClass(DEFAULT_CLASS[target] ?? availableClasses[0]?.value ?? "11");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing course for edit mode
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
      setInternalName((course as any).internal_name ?? "");
      setDescription(course.description ?? "");
      setDetailedDescription((course as any).detailed_description ?? "");
      setExistingThumbnail(course.thumbnail_url ?? null);
      setLanguage(((course as any).language ?? "Hinglish") as "Hinglish" | "English");
      setTarget((course as any).target ?? "JEE");
      setSelectedClass((course as any).class ?? "11");
      setCourseEndDate((course as any).course_end_date ?? "");
      setIsCourseFree((course as any).is_course_free ?? false);
      setMrp(Number((course as any).mrp ?? 0));
      setSalePrice(Number((course as any).sale_price ?? 0));
      setShowPriceWithGst((course as any).show_price_with_gst ?? false);
      setMaxUsageDays((course as any).max_usage_days ?? "");
      setIsActive((course as any).is_active ?? false);
      setPriority(Number((course as any).priority ?? 0));

      setBadge(course.badge ?? "");
      setTags((course.tags ?? []) as string[]);
      setLoading(false);
    };
    load();
  }, [isEditMode, courseId]);

  const addTag = () => { const v = tagInput.trim().toLowerCase(); if (!v || tags.includes(v)) return; setTags([...tags, v]); setTagInput(""); };

  const submit = async (publish: boolean) => {
    if (!user) return toast.error("Please sign in");
    if (!name.trim()) return toast.error("Course title is required");
    if (!internalName.trim()) return toast.error("Internal name is required");

    setSubmitting(true);

    let thumbnailUrl: string | null = existingThumbnail;
    if (thumbnailFile) {
      const path = `${user.id}/${Date.now()}-${thumbnailFile.name}`;
      const { error: upErr } = await supabase.storage.from("educator-uploads").upload(path, thumbnailFile);
      if (upErr) { toast.error("Thumbnail upload failed"); setSubmitting(false); return; }
      thumbnailUrl = supabase.storage.from("educator-uploads").getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: name.trim(),
      internal_name: internalName.trim(),
      description: description || null,
      detailed_description: detailedDescription || null,
      thumbnail_url: thumbnailUrl,
      language,
      target,
      class: selectedClass,
      course_end_date: courseEndDate || null,
      is_course_free: isCourseFree,
      mrp: isCourseFree ? 0 : mrp,
      sale_price: isCourseFree ? 0 : salePrice,
      show_price_with_gst: showPriceWithGst,
      max_usage_days: isCourseFree && maxUsageDays !== "" ? Number(maxUsageDays) : null,
      is_active: publish ? true : isActive,
      priority,

      badge: badge.trim() || null,
      tags,
    };

    let savedCourseId = courseId;
    if (!isEditMode) {
      const baseSlug = slugify(name) || `course-${Date.now()}`;
      const { data: inserted, error } = await supabase
        .from("courses")
        .insert({ ...payload, slug: `${baseSlug}-${Date.now().toString(36)}`, created_by: user.id })
        .select("id")
        .single();
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      savedCourseId = inserted?.id ?? null;
    } else {
      const { error } = await supabase.from("courses").update(payload).eq("id", courseId!);
      if (error) { toast.error(error.message); setSubmitting(false); return; }
    }

    // A free course makes all of its content free. Flag every lesson / content
    // item as a free preview. (Switching back to paid is intentionally left
    // alone — admins re-lock individual items manually.)
    if (isCourseFree && savedCourseId) {
      const [{ error: lessonsErr }, { error: itemsErr }] = await Promise.all([
        supabase.from("lessons").update({ is_free_preview: true }).eq("course_id", savedCourseId),
        supabase.from("content_items").update({ is_free_preview: true }).eq("course_id", savedCourseId),
      ]);
      if (lessonsErr || itemsErr) {
        toast.error("Course saved, but some content could not be marked free");
      }
    }

    toast.success(isEditMode ? "Course updated" : publish ? "Course published!" : "Draft saved");
    setSubmitting(false);
    navigate("/admin/courses");
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
      {ConfirmDialog}
      <h1 className="text-xl font-bold text-foreground">{isEditMode ? "Edit Course" : "Create New Course"}</h1>

      {/* ── Basic Info ────────────────────────────────────────────────────── */}
      <Section title="Basic Info">
        <Field label="Course Title (shown to students)">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. JEE Physics Booster 2027" />
        </Field>
        <Field label="Internal Name (not visible to students)">
          <input value={internalName} onChange={(e) => setInternalName(e.target.value)} className={inputCls} placeholder="e.g. PHY-JEE-2027-HINGLISH" />
        </Field>
        <Field label="Short Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="One or two sentences shown as a preview…" />
          <p className="text-[10px] text-muted-foreground mt-1">{description.length}/300 chars — shown on course cards and as the hero excerpt</p>
        </Field>
        <Field label="Detailed Description">
          <RichTextEditor
            content={detailedDescription}
            onChange={setDetailedDescription}
            placeholder="Describe the course in detail — topics covered, prerequisites, who it's for…"
          />
        </Field>

        {/* Thumbnail */}
        <Field label="Thumbnail">
          {(existingThumbnail || thumbnailFile) && (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted mb-3">
              <img src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : existingThumbnail!} alt="Thumbnail" className="h-full w-full object-cover" />
            </div>
          )}
          <label className="block cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} />
            <div className="rounded-lg border-2 border-dashed border-border bg-background p-6 flex flex-col items-center justify-center hover:border-primary transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                {thumbnailFile ? thumbnailFile.name : existingThumbnail ? "Click to replace thumbnail" : "Click to upload thumbnail"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Recommended: 16:9 · 1280×720px</p>
            </div>
          </label>
        </Field>

        {/* Language */}
        <Field label="Language">
          <div className="flex gap-2">
            {(["Hinglish", "English"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  language === lang ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted/30"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* ── Targeting ────────────────────────────────────────────────────── */}
      <Section title="Targeting">
        <Field label="Target Exam">
          <div className="flex gap-3 flex-wrap">
            {TARGET_OPTIONS.map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={t} checked={target === t} onChange={() => setTarget(t)} className="accent-primary" />
                <span className="text-sm font-medium text-foreground">{t}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Class">
          <div className="flex gap-2 flex-wrap">
            {availableClasses.map((cls) => (
              <button
                key={cls.value}
                type="button"
                onClick={() => setSelectedClass(cls.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedClass === cls.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted/30"
                }`}
              >
                {cls.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Course End Date (optional)">
          <input type="date" value={courseEndDate} onChange={(e) => setCourseEndDate(e.target.value)} className={inputCls} />
        </Field>
      </Section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Section title="Pricing">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCourseFree((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCourseFree ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isCourseFree ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm font-medium text-foreground">Free Course</span>
        </div>

        {isCourseFree ? (
          <Field label="Access Duration (days from enrollment)">
            <input
              type="number"
              value={maxUsageDays}
              onChange={(e) => setMaxUsageDays(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}
              placeholder="e.g. 90 (leave blank for unlimited)"
              min={1}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="MRP">
              <div className="flex items-center rounded-lg border border-border bg-background">
                <IndianRupee className="h-4 w-4 text-muted-foreground ml-3 shrink-0" />
                <input type="number" value={mrp || ""} onChange={(e) => setMrp(Number(e.target.value) || 0)} className="flex-1 bg-transparent px-2 py-2 text-sm outline-none" placeholder="2500" min={0} />
              </div>
            </Field>
            <Field label="Sale Price">
              <div className="flex items-center rounded-lg border border-border bg-background">
                <IndianRupee className="h-4 w-4 text-muted-foreground ml-3 shrink-0" />
                <input type="number" value={salePrice || ""} onChange={(e) => setSalePrice(Number(e.target.value) || 0)} className="flex-1 bg-transparent px-2 py-2 text-sm outline-none" placeholder="1299" min={0} />
              </div>
            </Field>
            <Field label="Discount (auto-computed)">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {discountPercent > 0 ? `${discountPercent}% OFF` : "—"}
              </div>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <input id="gst" type="checkbox" checked={showPriceWithGst} onChange={(e) => setShowPriceWithGst(e.target.checked)} className="accent-primary h-4 w-4" />
              <label htmlFor="gst" className="text-sm font-medium text-foreground cursor-pointer">Show price with 18% GST</label>
            </div>
          </div>
        )}

        {showPriceWithGst && !isCourseFree && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/30 border border-border px-3 py-2">
            Student sees: ₹{Math.round(salePrice * 1.18).toLocaleString()} (incl. 18% GST)
          </p>
        )}
      </Section>

      {/* ── Publishing ───────────────────────────────────────────────────── */}
      <Section title="Publishing">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              const next = !isActive;
              if (!next && isEditMode && courseId) {
                const ok = await confirm({
                  title: `Deactivate this course?`,
                  description: "Students will no longer see this course in the catalog. Existing enrolled students keep their access. You can reactivate at any time.",
                  confirmLabel: "Deactivate course",
                });
                if (!ok) return;
                const { error } = await supabase.from("courses").update({ is_active: false }).eq("id", courseId);
                if (error) return toast.error(error.message);
                toast.success("Course deactivated");
              } else if (next && isEditMode && courseId) {
                const { error } = await supabase.from("courses").update({ is_active: true }).eq("id", courseId);
                if (error) return toast.error(error.message);
                toast.success("Course activated");
              }
              setIsActive(next);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm font-medium text-foreground">Active (visible in store)</span>
        </div>
        <Field label="Priority (lower = shown first, decimals allowed)">
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseFloat(e.target.value) || 0)}
            className={inputCls}
            min={0}
            step={0.1}
          />
        </Field>
        <Field label="Badge">
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="" checked={badge === ""} onChange={() => setBadge("")} className="accent-primary" />
              <span className="text-sm font-medium text-foreground">None</span>
            </label>
            {BADGE_OPTIONS.map((b) => (
              <label key={b} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={b} checked={badge === b} onChange={() => setBadge(b)} className="accent-primary" />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  b === "Bestseller" ? "bg-amber-400 text-amber-950"
                  : b === "Hot" ? "bg-red-500 text-white"
                  : "bg-emerald-500 text-white"
                }`}>{b}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Tags">
          <div className="flex gap-2 mb-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} className={`flex-1 ${inputCls}`} placeholder="Add tag..." />
            <button type="button" onClick={addTag} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Tag className="h-3 w-3" />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </Section>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button disabled={submitting} onClick={() => submit(false)} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Draft"}
        </button>
        <button disabled={submitting} onClick={() => submit(true)} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : isEditMode ? "Save & Publish" : "Publish Course"}
        </button>
      </div>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default CreateCoursePage;
