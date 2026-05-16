import { Settings, User, Bell, Shield, Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const TABS = ["Profile", "Notifications", "Security"] as const;
type Tab = (typeof TABS)[number];

const MentorSettingsPage = () => {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("Profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [chatNotif, setChatNotif] = useState(true);
  const [reportNotif, setReportNotif] = useState(true);

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    const stored = localStorage.getItem(`mentor_notif_${user.id}`);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setChatNotif(!!p.chatNotif);
        setReportNotif(!!p.reportNotif);
      } catch {}
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, country, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setName(data?.full_name || "");
      setPhone(data?.phone || "");
      setCity(data?.city || "");
      setCountry(data?.country || "");
      setAvatarUrl(data?.avatar_url || "");
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone, city, country })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      await refreshProfile();
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setUploading(false);
    if (dbErr) {
      toast({ title: "Could not save photo", description: dbErr.message, variant: "destructive" });
      return;
    }
    setAvatarUrl(publicUrl);
    toast({ title: "Photo updated" });
    await refreshProfile();
  };

  const persistNotif = (next: { chatNotif: boolean; reportNotif: boolean }) => {
    if (!user) return;
    localStorage.setItem(`mentor_notif_${user.id}`, JSON.stringify(next));
  };

  const changePassword = async () => {
    if (newPw.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setPwOpen(false);
      setNewPw("");
      setConfirmPw("");
      toast({ title: "Password updated" });
    }
  };

  const initials = (name || "M").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-center gap-3">
          <Settings className="h-7 w-7" />
          <h1 className="text-2xl font-black font-display">Settings</h1>
        </div>
        <p className="text-white/90 text-sm mt-1">Manage your mentor profile and preferences</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t === "Profile" ? User : t === "Notifications" ? Bell : Shield;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t}
            </button>
          );
        })}
      </div>

      {tab === "Profile" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-secondary/20 ring-2 ring-border overflow-hidden flex items-center justify-center text-xl font-black text-secondary">
                {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : initials}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{name || "Mentor"}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" value={name} onChange={setName} disabled={loading} />
            <Field label="Email" value={email} disabled />
            <Field label="Phone" value={phone} onChange={setPhone} disabled={loading} placeholder="+91 ..." />
            <Field label="City" value={city} onChange={setCity} disabled={loading} />
            <Field label="Country" value={country} onChange={setCountry} disabled={loading} />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving || loading}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {tab === "Notifications" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Student Chat Messages</p>
              <p className="text-xs text-muted-foreground">Notify when a student sends you a message</p>
            </div>
            <Toggle
              on={chatNotif}
              toggle={() => {
                const v = !chatNotif;
                setChatNotif(v);
                persistNotif({ chatNotif: v, reportNotif });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Performance Reports</p>
              <p className="text-xs text-muted-foreground">Weekly summary of your students' progress</p>
            </div>
            <Toggle
              on={reportNotif}
              toggle={() => {
                const v = !reportNotif;
                setReportNotif(v);
                persistNotif({ chatNotif, reportNotif: v });
              }}
            />
          </div>
        </div>
      )}

      {tab === "Security" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <button
            onClick={() => setPwOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Change Password
          </button>
        </div>
      )}

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Choose a new password (at least 8 characters).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setPwOpen(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted">Cancel</button>
            <button onClick={changePassword} disabled={pwSaving} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {pwSaving ? "Saving..." : "Update Password"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) => (
  <div>
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
    />
  </div>
);

export default MentorSettingsPage;
