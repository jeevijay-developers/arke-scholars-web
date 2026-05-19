import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, KeyRound, ShieldCheck, User as UserIcon } from "lucide-react";
import CityStateFields from "@/components/CityStateFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const AdminProfilePage = () => {
  const { user: authUser, isSuperAdmin, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    avatar_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, state, country, avatar_url")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setForm({
          full_name: data.full_name || "",
          phone: data.phone || "",
          city: (data as any).city || "",
          state: (data as any).state || "",
          country: data.country || "",
          avatar_url: data.avatar_url || "",
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authUser]);

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
      })
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
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
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

  const handlePasswordChange = async () => {
    if (pwd.next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdSaving(false);
    if (error) {
      toast.error(error.message || "Could not update password");
      return;
    }
    toast.success("Password updated");
    setPwd({ next: "", confirm: "" });
  };

  const initials = (form.full_name || authUser?.email || "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-black font-display text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your {isSuperAdmin ? "super admin" : "admin"} account details and password.
        </p>
      </div>

      {/* Avatar + identity */}
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center text-xl font-black text-primary overflow-hidden">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt={form.full_name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md disabled:opacity-60"
            aria-label="Change avatar"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-foreground">{form.full_name || "Unnamed admin"}</p>
          <p className="text-xs text-muted-foreground truncate">{authUser?.email}</p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            <ShieldCheck className="h-3 w-3" />
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
        </div>
      </div>

      {/* Personal info */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">Personal Information</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Email" value={authUser?.email || ""} disabled />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
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

      {/* Password */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">Change Password</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New Password"
            type="password"
            value={pwd.next}
            onChange={(v) => setPwd({ ...pwd, next: v })}
          />
          <Field
            label="Confirm Password"
            type="password"
            value={pwd.confirm}
            onChange={(v) => setPwd({ ...pwd, confirm: v })}
          />
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={pwdSaving || !pwd.next}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-2.5 text-xs font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pwdSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Update Password
        </button>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) => (
  <div>
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
    />
  </div>
);

export default AdminProfilePage;
