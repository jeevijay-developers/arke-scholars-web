/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Camera, Flame, Target, ClipboardCheck, Trophy, Loader2, School, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import CityStateFields from "@/components/CityStateFields";
import { useExams } from "@/hooks/useExams";

const tabItems = ["Personal Info"];
const CLASS_LEVELS = ["8", "9", "10", "11", "12", "12th pass"];
type SchoolOption = { id: string; name: string; city: string | null };

const ProfilePage = () => {
  const { user } = useAppStore();
  const { user: authUser, refreshProfile } = useAuth();
  const { examNames: EXAMS } = useExams();
  const [activeTab, setActiveTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    target_exam: "",
    class_level: "",
    avatar_url: "",
  });
  const [stats, setStats] = useState({ streak: 0, tests: 0, accuracy: 0, percentile: 0 });

  // School selection state
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [schoolSearching, setSchoolSearching] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      const [profileRes, streakRes, sessionsRes, testsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", authUser.id).maybeSingle(),
        supabase.rpc("get_user_streak", { _user_id: authUser.id }),
        supabase.from("study_sessions").select("questions_attempted, questions_correct").eq("user_id", authUser.id),
        supabase.from("test_attempts").select("percentile").eq("user_id", authUser.id).order("attempted_at", { ascending: false }).limit(5),
      ]);
      if (!active) return;
      const p = profileRes.data as any;
      if (p) {
        setForm({
          full_name: p.full_name || "",
          phone: p.phone || "",
          city: p.city || "",
          state: p.state || "",
          country: p.country || "",
          target_exam: p.target_exam || "",
          class_level: p.class_level || "",
          avatar_url: p.avatar_url || "",
        });
        if (p.school_id) {
          setSchoolId(p.school_id);
          const { data: sch } = await (supabase as any).from("schools").select("name").eq("id", p.school_id).maybeSingle();
          if (active) setSchoolName(sch?.name ?? null);
        }
      }
      const sessions = sessionsRes.data ?? [];
      const att = sessions.reduce((s, r) => s + (r.questions_attempted ?? 0), 0);
      const cor = sessions.reduce((s, r) => s + (r.questions_correct ?? 0), 0);
      const tests = testsRes.data ?? [];
      const pctile = tests.length > 0 ? tests.reduce((s, t) => s + (Number(t.percentile) || 0), 0) / tests.length : 0;
      setStats({
        streak: (streakRes.data as number) ?? 0,
        tests: tests.length,
        accuracy: att > 0 ? Math.round((cor / att) * 100) : 0,
        percentile: Math.round(pctile * 10) / 10,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [authUser]);

  const handleSchoolSearch = async (q: string) => {
    setSchoolSearch(q);
    if (q.trim().length < 1) {
      setSchoolOptions([]);
      setShowSchoolDropdown(false);
      return;
    }
    setSchoolSearching(true);
    setShowSchoolDropdown(true);
    const { data } = await (supabase as any)
      .from("schools")
      .select("id, name, city")
      .eq("is_active", true)
      .ilike("name", `%${q.trim()}%`)
      .limit(8);
    setSchoolOptions((data ?? []) as SchoolOption[]);
    setSchoolSearching(false);
  };

  const selectSchool = (s: SchoolOption) => {
    setSchoolId(s.id);
    setSchoolName(s.name);
    setSchoolSearch("");
    setSchoolOptions([]);
    setShowSchoolDropdown(false);
  };

  const clearSchool = () => {
    setSchoolId(null);
    setSchoolName(null);
    setSchoolSearch("");
    setSchoolOptions([]);
  };

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        state: form.state,
        country: form.country,
        target_exam: form.target_exam,
        class_level: form.class_level || null,
        school_id: schoolId,
      } as any)
      .eq("user_id", authUser.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save profile");
      return;
    }
    toast.success("Profile updated");
    await refreshProfile();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${authUser.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast.error("Upload failed");
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", authUser.id);
    setUploading(false);
    if (dbErr) {
      toast.error("Saved upload but couldn't update profile");
      return;
    }
    setForm((f) => ({ ...f, avatar_url: publicUrl }));
    toast.success("Photo updated");
    await refreshProfile();
  };

  const initials = form.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "U";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-0">
      {/* Profile Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark p-8 text-center">
        <div className="absolute inset-0 grid-texture opacity-40 pointer-events-none" />
        <div className="relative">
          <div className="relative inline-block">
            <div className="h-20 w-20 rounded-full bg-white/25 ring-4 ring-white/30 mx-auto flex items-center justify-center text-2xl font-black text-white overflow-hidden">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt={form.full_name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white flex items-center justify-center shadow-md disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Camera className="h-3.5 w-3.5 text-primary" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <h2 className="text-xl font-black font-display mt-3 text-white drop-shadow-sm">{form.full_name || "Student"}</h2>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {form.target_exam && <span className="rounded-full bg-white/25 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold text-white">{form.target_exam}</span>}
            {schoolName && <span className="inline-flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2.5 py-0.5 text-[10px] font-bold text-white"><School className="h-3 w-3" />{schoolName}</span>}
          </div>
          <p className="text-xs text-white/90 mt-2 font-medium">{[form.city, form.country].filter(Boolean).join(", ") || user?.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 p-4">
        {[
          { icon: Flame, value: `${stats.streak}d`, label: "Streak" },
          { icon: ClipboardCheck, value: String(stats.tests), label: "Tests" },
          { icon: Target, value: stats.accuracy ? `${stats.accuracy}%` : "—", label: "Accuracy" },
          { icon: Trophy, value: stats.percentile ? `${stats.percentile}` : "—", label: "Percentile" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <s.icon className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 overflow-x-auto no-scrollbar">
        {tabItems.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${i === activeTab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 lg:p-6">
        {activeTab === 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold font-display text-foreground">Personal Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <Field label="Email" value={user?.email || ""} disabled />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <SelectField label="Target Exam" value={form.target_exam} options={EXAMS} onChange={(v) => setForm({ ...form, target_exam: v })} />
              <SelectField label="Class Level" value={form.class_level} options={CLASS_LEVELS} onChange={(v) => setForm({ ...form, class_level: v })} />
              {/* School pairs with Class Level */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">School</label>
                {schoolName ? (
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <School className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 text-sm font-semibold text-foreground">{schoolName}</span>
                    <button
                      type="button"
                      onClick={clearSchool}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Change school"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    {schoolSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    <input
                      type="text"
                      value={schoolSearch}
                      onChange={(e) => handleSchoolSearch(e.target.value)}
                      onBlur={() => setTimeout(() => setShowSchoolDropdown(false), 200)}
                      onFocus={() => schoolSearch.length > 0 && setShowSchoolDropdown(true)}
                      placeholder="Search your school..."
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {showSchoolDropdown && (
                      <div className="absolute z-20 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                        {schoolOptions.length === 0 && !schoolSearching ? (
                          <p className="px-3 py-2.5 text-xs text-muted-foreground">No registered schools found</p>
                        ) : (
                          schoolOptions.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); selectSchool(s); }}
                              className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors"
                            >
                              <p className="text-sm font-semibold text-foreground">{s.name}</p>
                              {s.city && <p className="text-[11px] text-muted-foreground">{s.city}</p>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">Linking your school lets you appear on your school's leaderboard</p>
              </div>
              {/* City / State / Country — spans full width */}
              <div className="sm:col-span-2">
                <CityStateFields
                  city={form.city}
                  state={form.state}
                  country={form.country}
                  onCityChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  onStateChange={(v) => setForm((f) => ({ ...f, state: v }))}
                  onCountryChange={(v) => setForm((f) => ({ ...f, country: v }))}
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) => (
  <div>
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
    <input
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
    />
  </div>
);

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default ProfilePage;
