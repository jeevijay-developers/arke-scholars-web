import { Settings, Globe, Bell, Database, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type PlatformSettings = {
  id: number;
  site_name: string;
  maintenance_mode: boolean;
  open_registrations: boolean;
  admin_email_alerts: boolean;
  updated_at: string;
};

const AdminSettingsPage = () => {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error(error.message);
      setSettings((data as PlatformSettings) ?? null);
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<PlatformSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        site_name: settings.site_name,
        maintenance_mode: settings.maintenance_mode,
        open_registrations: settings.open_registrations,
        admin_email_alerts: settings.admin_email_alerts,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  const Toggle = ({ on, toggle, disabled }: { on: boolean; toggle: () => void; disabled?: boolean }) => (
    <button
      onClick={toggle}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 text-sm text-muted-foreground">Settings unavailable.</div>;
  }

  const readOnly = !isSuperAdmin;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-center gap-3"><Settings className="h-7 w-7" /><h1 className="text-2xl font-black font-display">Platform Settings</h1></div>
        <p className="text-white/90 text-sm mt-1">
          {readOnly ? "Read-only view. Only super admins can change platform settings." : "Configure global platform settings and features"}
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Globe className="h-4 w-4 text-primary" /> General</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Site Name</label>
              <input
                value={settings.site_name}
                disabled={readOnly}
                onChange={(e) => update({ site_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-foreground">Maintenance Mode</p><p className="text-xs text-muted-foreground">Temporarily disable access</p></div>
              <Toggle on={settings.maintenance_mode} disabled={readOnly} toggle={() => update({ maintenance_mode: !settings.maintenance_mode })} />
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-foreground">Open Registrations</p><p className="text-xs text-muted-foreground">Allow new student signups</p></div>
              <Toggle on={settings.open_registrations} disabled={readOnly} toggle={() => update({ open_registrations: !settings.open_registrations })} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Bell className="h-4 w-4 text-primary" /> Notifications</h3>
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-foreground">Email Alerts</p><p className="text-xs text-muted-foreground">Admin email notifications for critical events</p></div>
            <Toggle on={settings.admin_email_alerts} disabled={readOnly} toggle={() => update({ admin_email_alerts: !settings.admin_email_alerts })} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Database className="h-4 w-4 text-primary" /> Data</h3>
          <div className="flex gap-3">
            <button disabled className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground opacity-50">Export All Data</button>
            <button disabled className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground opacity-50">Clear Cache</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Coming soon.</p>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettingsPage;
