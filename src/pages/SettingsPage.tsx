import { Settings, Lock, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SettingsPage = () => {
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete your account and all associated data. This action cannot be undone."
    );
    if (!confirmed) return;

    const { error } = await supabase.auth.admin.deleteUser(
      (await supabase.auth.getUser()).data.user?.id || ""
    );
    if (error) {
      toast.error("Failed to delete account. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    navigate("/login");
  };

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
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4"><Lock className="h-4 w-4 text-primary" /> Security</h3>
          <button
            onClick={() => navigate("/auth/change-password")}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Change Password
          </button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-card p-5">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-2"><Trash2 className="h-4 w-4" /> Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-3">Once you delete your account, there is no going back.</p>
          <button
            onClick={handleDeleteAccount}
            className="rounded-lg border border-destructive px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
