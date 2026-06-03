import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Megaphone, Plus, Edit3, Trash2, Loader2, Eye, EyeOff, X, Upload } from "lucide-react";
import { useCourseBanners, type CourseBanner } from "@/hooks/useCourseBanners";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type EditDraft = Partial<CourseBanner> & { title: string };

// Accepted banner image formats.
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

const empty: EditDraft = {
  title: "",
  subtitle: "",
  image_url: "",
  cta_label: "",
  cta_link: "",
  sort_order: 0,
  is_active: true,
};

const AdminCourseBannersPage = () => {
  const { banners, loading, reload } = useCourseBanners({ includeInactive: true });
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(banners, 15);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      e.target.value = "";
      return toast.error("Only JPG, PNG, WEBP, GIF or AVIF images are allowed");
    }
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `banners/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("question-images").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return toast.error("Upload failed");
    }
    const { data: { publicUrl } } = supabase.storage.from("question-images").getPublicUrl(path);
    setEditing((d) => (d ? { ...d, image_url: publicUrl } : d));
    setUploading(false);
    toast.success("Image uploaded");
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) return toast.error("Banner title is required");
    setSaving(true);
    const payload: any = {
      title: editing.title.trim(),
      subtitle: editing.subtitle?.trim() || null,
      image_url: editing.image_url?.trim() || null,
      cta_label: editing.cta_label?.trim() || null,
      cta_link: editing.cta_link?.trim() || null,
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("course_banners").update(payload).eq("id", editing.id)
      : await (supabase as any).from("course_banners").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Banner updated" : "Banner created");
    setEditing(null);
    reload();
  };

  const toggleActive = async (b: CourseBanner) => {
    const { error } = await (supabase as any)
      .from("course_banners").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const remove = async (b: CourseBanner) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    const { error } = await (supabase as any).from("course_banners").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Banner deleted");
    reload();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Course Banners
          </h1>
          <p className="text-sm text-muted-foreground">
            Promotional banners shown above the hero on the landing page. Only active banners are visible to visitors.
          </p>
        </div>
        <button onClick={() => setEditing({ ...empty, sort_order: (banners[banners.length - 1]?.sort_order ?? 0) + 10 })}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> New Banner
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold w-16">Order</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Subtitle</th>
                  <th className="px-3 py-2 font-semibold">CTA</th>
                  <th className="px-3 py-2 font-semibold w-24">Status</th>
                  <th className="px-3 py-2 w-32" />
                </tr>
              </thead>
              <tbody>
                {paged.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{b.sort_order}</td>
                    <td className="px-3 py-2 font-bold text-foreground">{b.title}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{b.subtitle || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.cta_label || "—"}</td>
                    <td className="px-3 py-2">
                      {b.is_active
                        ? <span className="text-secondary font-bold">Active</span>
                        : <span className="text-muted-foreground">Hidden</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => toggleActive(b)} className="p-1 hover:bg-muted rounded" title={b.is_active ? "Deactivate" : "Activate"}>
                        {b.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setEditing({ ...b })} className="p-1 hover:bg-muted rounded ml-1"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => remove(b)} className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No banners yet — create one to show a launch announcement on the homepage.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? "Edit Banner" : "New Banner"}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <Field label="Title *">
              <input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. New NEET 2027 Dropper Batch — Enrolling Now" className="banner-input" />
            </Field>
            <Field label="Subtitle">
              <input value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} placeholder="e.g. Limited seats · Starts 1 July" className="banner-input" />
            </Field>
            <Field label="Banner Image">
              {editing.image_url ? (
                <img src={editing.image_url} alt="Banner preview" className="mb-2 h-28 w-full border border-border object-cover" />
              ) : (
                <div className="mb-2 h-28 w-full border border-dashed border-border bg-muted/40" />
              )}
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : editing.image_url ? "Replace image" : "Upload image"}
                  <input type="file" accept={ACCEPT_ATTR} className="hidden" disabled={uploading} onChange={handleImageUpload} />
                </label>
                {editing.image_url && (
                  <button type="button" onClick={() => setEditing({ ...editing, image_url: "" })} className="text-xs text-destructive hover:underline">Remove</button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Recommended aspect ratio ~ 16:9 (e.g. 1200×675). Max 5MB</p>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CTA Label">
                <input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} placeholder="e.g. Explore" className="banner-input" />
              </Field>
              <Field label="CTA Link">
                <input value={editing.cta_link ?? ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} placeholder="e.g. /courses?exam=NEET" className="banner-input" />
              </Field>
            </div>
            <Field label="Sort Order">
              <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="banner-input" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active (visible on the landing page)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.banner-input { width: 100%; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .banner-input:focus { border-color: hsl(var(--primary)); }`}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

export default AdminCourseBannersPage;
