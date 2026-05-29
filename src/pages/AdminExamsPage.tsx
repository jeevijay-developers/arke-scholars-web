import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Plus, Edit3, Trash2, Loader2, Eye, EyeOff, X } from "lucide-react";
import { useExams, type Exam } from "@/hooks/useExams";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/TablePagination";

type EditDraft = Partial<Exam> & { name: string };

const empty: EditDraft = {
  name: "",
  code: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

const AdminExamsPage = () => {
  const { exams, loading, reload } = useExams({ includeInactive: true });
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const { paged, page, setPage, totalPages, total, pageSize } = usePagination(exams, 15);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error("Exam name is required");
    setSaving(true);
    const payload: any = {
      name: editing.name.trim(),
      code: editing.code?.trim() || null,
      description: editing.description?.trim() || null,
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("exams").update(payload).eq("id", editing.id)
      : await (supabase as any).from("exams").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Exam updated" : "Exam created");
    setEditing(null);
    reload();
  };

  const toggleActive = async (e: Exam) => {
    const { error } = await (supabase as any)
      .from("exams").update({ is_active: !e.is_active }).eq("id", e.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const remove = async (e: Exam) => {
    if (!confirm(`Delete exam "${e.name}"? Existing questions/courses tagged with it will keep the text value.`)) return;
    const { error } = await (supabase as any).from("exams").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Exam deleted");
    reload();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Exam Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the list of target exams used across courses, tests, question bank and compete.
          </p>
        </div>
        <button onClick={() => setEditing({ ...empty, sort_order: (exams[exams.length - 1]?.sort_order ?? 0) + 10 })}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> New Exam
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
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold w-24">Status</th>
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">{e.sort_order}</td>
                  <td className="px-3 py-2 font-bold text-foreground">{e.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.code || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-md truncate">{e.description || "—"}</td>
                  <td className="px-3 py-2">
                    {e.is_active
                      ? <span className="text-secondary font-bold">Active</span>
                      : <span className="text-muted-foreground">Hidden</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => toggleActive(e)} className="p-1 hover:bg-muted rounded" title={e.is_active ? "Deactivate" : "Activate"}>
                      {e.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditing({ ...e })} className="p-1 hover:bg-muted rounded ml-1"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => remove(e)} className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {exams.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No exams yet — create the first one.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl shadow-xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? "Edit Exam" : "New Exam"}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <Field label="Name *">
              <input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. JEE Main" className="exam-input" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code">
                <input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="e.g. jee-main" className="exam-input" />
              </Field>
              <Field label="Sort Order">
                <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="exam-input" />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="exam-input" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Active (visible in dropdowns and filters)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.exam-input { width: 100%; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .exam-input:focus { border-color: hsl(var(--primary)); }`}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

export default AdminExamsPage;
