import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, X, HeartHandshake, ShieldCheck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Mentor = { user_id: string; full_name: string | null };
type PoolEntry = { id: string; primary_mentor_id: string; backup_mentor_id: string };
type Handover = {
  id: string; primary_mentor_id: string; backup_mentor_id: string;
  started_at: string; ends_at: string; ended_early_at: string | null; reason: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const isActive = (h: Handover) => {
  const end = new Date(h.ended_early_at ?? h.ends_at).getTime();
  const start = new Date(h.started_at).getTime();
  const now = Date.now();
  return now >= start && now <= end;
};

const AdminMentorHandoversPage = () => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrimary, setSelectedPrimary] = useState<string>("");
  const [addBackup, setAddBackup] = useState<string>("");
  const [handoverDialog, setHandoverDialog] = useState(false);
  const [handoverPrimary, setHandoverPrimary] = useState<string>("");
  const [handoverBackup, setHandoverBackup] = useState<string>("");
  const [handoverEnds, setHandoverEnds] = useState<string>("");
  const [handoverReason, setHandoverReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: roles }, { data: poolData }, { data: hData }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "mentor"),
      supabase.from("mentor_backup_pool").select("*"),
      supabase.from("mentor_handovers").select("*").order("started_at", { ascending: false }),
    ]);
    const ids = (roles ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids)
      : { data: [] as Mentor[] };
    const map = new Map((profs ?? []).map((p) => [p.user_id, p.full_name] as const));
    const list = ids.map((id) => ({ user_id: id, full_name: map.get(id) ?? null }))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    setMentors(list);
    setPool(poolData ?? []);
    setHandovers((hData ?? []) as Handover[]);
    if (!selectedPrimary && list[0]) setSelectedPrimary(list[0].user_id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const mentorName = (id: string) => mentors.find((m) => m.user_id === id)?.full_name ?? "Mentor";

  const currentPool = useMemo(
    () => pool.filter((p) => p.primary_mentor_id === selectedPrimary),
    [pool, selectedPrimary],
  );
  const availableBackups = useMemo(
    () => mentors.filter(
      (m) => m.user_id !== selectedPrimary &&
        !currentPool.some((p) => p.backup_mentor_id === m.user_id),
    ),
    [mentors, selectedPrimary, currentPool],
  );

  const addPoolEntry = async () => {
    if (!selectedPrimary || !addBackup) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mentor_backup_pool").insert({
      primary_mentor_id: selectedPrimary,
      backup_mentor_id: addBackup,
      added_by: u.user?.id!,
    });
    if (error) return toast.error(error.message);
    setAddBackup("");
    toast.success("Backup added");
    load();
  };

  const removePoolEntry = async (id: string) => {
    const { error } = await supabase.from("mentor_backup_pool").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Backup removed");
    load();
  };

  const openHandover = () => {
    setHandoverPrimary(selectedPrimary);
    setHandoverBackup("");
    const def = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const off = def.getTimezoneOffset();
    setHandoverEnds(new Date(def.getTime() - off * 60_000).toISOString().slice(0, 16));
    setHandoverReason("");
    setHandoverDialog(true);
  };

  const submitHandover = async () => {
    if (!handoverPrimary || !handoverBackup || !handoverEnds) return toast.error("Fill all fields");
    const endsDate = new Date(handoverEnds);
    if (isNaN(endsDate.getTime()) || endsDate.getTime() < Date.now())
      return toast.error("End date must be in the future");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("mentor_handovers").insert({
      primary_mentor_id: handoverPrimary,
      backup_mentor_id: handoverBackup,
      ends_at: endsDate.toISOString(),
      reason: handoverReason.trim() || null,
      created_by: u.user?.id!,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Handover started");
    setHandoverDialog(false);
    load();
  };

  const endHandover = async (id: string) => {
    const { error } = await supabase
      .from("mentor_handovers")
      .update({ ended_early_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Handover ended");
    load();
  };

  const handoverPoolForPrimary = useMemo(
    () => pool.filter((p) => p.primary_mentor_id === handoverPrimary),
    [pool, handoverPrimary],
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-[#0F1729] p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black font-display flex items-center gap-2">
              <HeartHandshake className="h-6 w-6" /> Mentor Handovers
            </h1>
            <p className="text-white/90 text-sm mt-1">
              Configure backup mentors and trigger handovers when a primary is unavailable.
            </p>
          </div>
          <button
            onClick={openHandover}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1d2026] hover:bg-white/90"
          >
            <Plus className="h-4 w-4" /> New handover
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Backup pool editor */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-secondary" /> Backup pool
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Mentors who can cover for the selected primary. Admin assigns one of these during a handover.
              </p>
            </div>

            <div>
              <Label>Primary mentor</Label>
              <Select value={selectedPrimary} onValueChange={setSelectedPrimary}>
                <SelectTrigger><SelectValue placeholder="Pick a mentor" /></SelectTrigger>
                <SelectContent>
                  {mentors.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current pool</p>
              {currentPool.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No backups configured.</p>
              ) : (
                <div className="space-y-1.5">
                  {currentPool.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm font-medium">{mentorName(p.backup_mentor_id)}</span>
                      <Button size="sm" variant="ghost" onClick={() => removePoolEntry(p.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Add backup</Label>
                <Select value={addBackup} onValueChange={setAddBackup}>
                  <SelectTrigger><SelectValue placeholder="Select a mentor" /></SelectTrigger>
                  <SelectContent>
                    {availableBackups.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addPoolEntry} disabled={!addBackup}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </section>

          {/* Handovers */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" /> Handovers
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Active and recent coverage assignments.</p>
            </div>

            {handovers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No handovers yet.</p>
            ) : (
              <div className="space-y-2">
                {handovers.map((h) => {
                  const active = isActive(h);
                  return (
                    <div key={h.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm">
                          <p className="font-semibold text-foreground">
                            {mentorName(h.backup_mentor_id)} <span className="text-muted-foreground font-normal">covering for</span> {mentorName(h.primary_mentor_id)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(h.started_at)} → {fmtDate(h.ended_early_at ?? h.ends_at)}
                          </p>
                          {h.reason && <p className="text-xs text-foreground/80 mt-1">{h.reason}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                          ) : h.ended_early_at ? (
                            <Badge variant="secondary">Ended early</Badge>
                          ) : new Date(h.ends_at).getTime() < Date.now() ? (
                            <Badge variant="secondary">Completed</Badge>
                          ) : (
                            <Badge variant="outline">Scheduled</Badge>
                          )}
                          {active && (
                            <Button size="sm" variant="outline" onClick={() => endHandover(h.id)}>
                              End now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog open={handoverDialog} onOpenChange={setHandoverDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start a handover</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Primary (unavailable mentor)</Label>
              <Select value={handoverPrimary} onValueChange={(v) => { setHandoverPrimary(v); setHandoverBackup(""); }}>
                <SelectTrigger><SelectValue placeholder="Pick primary" /></SelectTrigger>
                <SelectContent>
                  {mentors.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Backup mentor (from pool)</Label>
              <Select value={handoverBackup} onValueChange={setHandoverBackup} disabled={!handoverPrimary}>
                <SelectTrigger>
                  <SelectValue placeholder={handoverPoolForPrimary.length === 0 ? "No backups in pool" : "Pick backup"} />
                </SelectTrigger>
                <SelectContent>
                  {handoverPoolForPrimary.map((p) => (
                    <SelectItem key={p.id} value={p.backup_mentor_id}>{mentorName(p.backup_mentor_id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {handoverPrimary && handoverPoolForPrimary.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Add at least one backup to this mentor's pool first.</p>
              )}
            </div>
            <div>
              <Label>Ends at</Label>
              <Input type="datetime-local" value={handoverEnds} onChange={(e) => setHandoverEnds(e.target.value)} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea rows={2} value={handoverReason} onChange={(e) => setHandoverReason(e.target.value)} placeholder="Vacation, leave, illness…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoverDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submitHandover} disabled={saving || !handoverBackup}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Start handover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMentorHandoversPage;
