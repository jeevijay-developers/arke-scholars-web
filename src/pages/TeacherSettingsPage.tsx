import { Settings, User, Wallet, Bell, Shield, Camera, Loader2 } from "lucide-react";
import CityStateFields from "@/components/CityStateFields";
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

const TeacherSettingsPage = () => {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [classNotif, setClassNotif] = useState(true);
  const [doubtNotif, setDoubtNotif] = useState(true);

  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutRequested, setPayoutRequested] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    const prefKey = `teacher_notif_${user.id}`;
    const stored = localStorage.getItem(prefKey);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setClassNotif(!!p.classNotif);
        setDoubtNotif(!!p.doubtNotif);
      } catch {}
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, state, country, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setName(data?.full_name || "");
      setPhone(data?.phone || "");
      setCity((data as any)?.city || "");
      setState((data as any)?.state || "");
      setCountry(data?.country || "");
      setAvatarUrl(data?.avatar_url || "");
      setProfileLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone, city, state, country } as any)
      .eq("user_id", user.id);
    setSavingProfile(false);
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

  const persistNotif = (next: { classNotif: boolean; doubtNotif: boolean }) => {
    if (!user) return;
    localStorage.setItem(`teacher_notif_${user.id}`, JSON.stringify(next));
  };

  const requestPayoutSetup = async () => {
    if (!user) return;
    setRequestingPayout(true);
    const { error } = await supabase.from("enquiries").insert({
      source: "payout_setup",
      name: name || "Teacher",
      email: user.email || "",
      phone: phone || null,
      message: "Please enable payouts for my account.",
    });
    setRequestingPayout(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
    } else {
      setPayoutRequested(true);
      toast({ title: "Request sent", description: "Our team will reach out within 2 business days." });
    }
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

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-center gap-3">
          <Settings className="h-7 w-7" />
          <h1 className="text-2xl font-black font-display">Settings</h1>
        </div>
        <p className="text-white/90 text-sm mt-1">Manage your teacher profile and preferences</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-primary" /> Profile
          </h3>

          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary-light ring-2 ring-border overflow-hidden flex items-center justify-center text-xl font-black text-primary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  (name || "T").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                )}
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
              <p className="text-sm font-bold text-foreground">{name || "Educator"}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
              <p className="text-[10px] text-muted-foreground mt-1">JPG/PNG, up to 2MB</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profileLoading}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                value={email}
                disabled
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={profileLoading}
                placeholder="+91 ..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <CityStateFields
                city={city}
                state={state}
                country={country}
                onCityChange={setCity}
                onStateChange={setState}
                onCountryChange={setCountry}
                disabled={profileLoading}
              />
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={savingProfile || profileLoading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-primary" /> Payouts
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Automated payouts aren't configured yet. Request setup and our finance team will collect your bank details and onboard you within 2 business days.
          </p>
          <button
            onClick={requestPayoutSetup}
            disabled={requestingPayout || payoutRequested}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {payoutRequested ? "Request submitted" : requestingPayout ? "Sending..." : "Request Payouts Setup"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Class Reminders</p>
                <p className="text-xs text-muted-foreground">30 min before class starts</p>
              </div>
              <Toggle
                on={classNotif}
                toggle={() => {
                  const v = !classNotif;
                  setClassNotif(v);
                  persistNotif({ classNotif: v, doubtNotif });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">New Doubts</p>
                <p className="text-xs text-muted-foreground">Get notified for student doubts</p>
              </div>
              <Toggle
                on={doubtNotif}
                toggle={() => {
                  const v = !doubtNotif;
                  setDoubtNotif(v);
                  persistNotif({ classNotif, doubtNotif: v });
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" /> Security
          </h3>
          <button
            onClick={() => setPwOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Change Password
          </button>
        </div>
      </div>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Choose a new password (at least 8 characters).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setPwOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={changePassword}
              disabled={pwSaving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pwSaving ? "Saving..." : "Update Password"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherSettingsPage;
