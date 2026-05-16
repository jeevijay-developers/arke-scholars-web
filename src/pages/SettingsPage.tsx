import { Settings, Moon, Globe, Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import NotificationPreferences from "@/components/NotificationPreferences";

const SettingsPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("en");

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
        <p className="text-white/90 text-sm mt-1">Manage your account preferences</p>
      </div>

      <div className="space-y-4">
        <NotificationPreferences />

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Moon className="h-4 w-4 text-primary" /> Appearance</h3>
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-foreground">Dark Mode</p><p className="text-xs text-muted-foreground">Switch to dark theme</p></div>
            <Toggle on={darkMode} toggle={() => setDarkMode(!darkMode)} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Globe className="h-4 w-4 text-primary" /> Language & Region</h3>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Lock className="h-4 w-4 text-primary" /> Security</h3>
          <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity">Change Password</button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-card p-5">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-2"><Trash2 className="h-4 w-4" /> Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-3">Once you delete your account, there is no going back.</p>
          <button className="rounded-lg border border-destructive px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors">Delete Account</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
