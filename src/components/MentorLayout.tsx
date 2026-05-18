import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Users, BarChart3, Settings, Flame, Search, Megaphone } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { memo, useCallback, useMemo } from "react";
import arkeLogo from "@/assets/arke-logo.png";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";

type NavItem = { label: string; icon: typeof Home; path: string };

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, path: "/mentor/dashboard" },
  { label: "My Students", icon: Users, path: "/mentor/students" },
  { label: "Announcements", icon: Megaphone, path: "/mentor/announcements" },
  { label: "Chats", icon: MessageCircle, path: "/mentor/chats" },
  { label: "Performance", icon: BarChart3, path: "/mentor/performance" },
  { label: "Settings", icon: Settings, path: "/mentor/settings" },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Avatar = ({ url, initials, className }: { url?: string; initials: string; className: string }) => (
  <div className={`overflow-hidden ${className}`}>
    {url ? <img src={url} alt={initials} className="h-full w-full object-cover" /> : <span>{initials}</span>}
  </div>
);

const MentorSidebar = memo(({ displayName, initials, avatarUrl, onLogout }: { displayName: string; initials: string; avatarUrl?: string; onLogout: () => void }) => {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex w-[220px] flex-col border-r border-border bg-card sticky top-0 h-screen overflow-y-auto">
      <div className="p-4 flex justify-center">
        <Link to="/" className="flex items-center justify-center w-full bg-white rounded-xl py-2 px-4 hover:opacity-95 transition-opacity">
          <img src={arkeLogo} alt="ARKE Logo" className="h-10 w-auto object-contain" />
        </Link>
        <div className="mt-3 rounded-md bg-secondary/15 px-2 py-1 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Mentor Portal</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Navigation</p>
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Avatar url={avatarUrl} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-secondary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">Mentor</p>
          </div>
        </div>
        <LogoutButton onConfirm={onLogout} />
      </div>
    </aside>
  );
});
MentorSidebar.displayName = "MentorSidebar";

const MentorLayout = () => {
  const { user, signOut } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const displayName = useMemo(
    () => storeUser?.full_name?.trim() || (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split("@")[0] || "Mentor",
    [storeUser?.full_name, user?.user_metadata, user?.email],
  );
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = useCallback(async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }, [signOut, navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <MentorSidebar displayName={displayName} initials={initials} avatarUrl={storeUser?.avatar_url} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center">
              <div className="bg-white rounded-lg p-1 flex items-center justify-center">
                <img src={arkeLogo} alt="ARKE Logo" className="h-6 w-auto object-contain" />
              </div>
            </div>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search students..."
                className="w-64 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar url={storeUser?.avatar_url} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-secondary" />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MentorLayout;
