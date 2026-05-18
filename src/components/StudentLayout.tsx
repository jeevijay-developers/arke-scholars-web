import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, Video, ClipboardCheck, MessageCircle, Swords, BarChart3, Trophy, User, Settings, Search, Flame, Users } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { memo, useCallback, useMemo } from "react";
import arkeLogo from "@/assets/arke-logo.png";
import GoalSelector from "@/components/GoalSelector";
import LiveBadge from "@/components/LiveBadge";
import NotificationBell from "@/components/NotificationBell";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useDoubts } from "@/hooks/useDoubts";
import { toast } from "sonner";

type StudentNavItem = {
  label: string;
  icon: React.ElementType;
  path: string;
  live?: boolean;
  badge?: number;
};

const buildNavItems = (doubtCount: number, liveCount: number): StudentNavItem[] => [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "My Learning", icon: BookOpen, path: "/my-courses" },
  { label: "Live Classes", icon: Video, path: "/my-live-classes", live: true, badge: liveCount || undefined },
  { label: "Tests", icon: ClipboardCheck, path: "/my-tests" },
  { label: "Doubts", icon: MessageCircle, path: "/doubts", badge: doubtCount || undefined },
  { label: "Mentor Chat", icon: Users, path: "/mentor-chat" },
];

const exploreItems: StudentNavItem[] = [
  { label: "Compete", icon: Swords, path: "/compete" },
  { label: "My Analytics", icon: BarChart3, path: "/analytics" },
  { label: "Leaderboard", icon: Trophy, path: "/leaderboard" },
];

const accountItems: StudentNavItem[] = [
  { label: "Profile", icon: User, path: "/profile" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

type SidebarProps = {
  fullName: string;
  avatarUrl?: string;
  initials: string;
  currentGoal: string;
  setCurrentGoal: (g: string) => void;
  onLogout: () => void;
  doubtCount: number;
  liveCount: number;
};

// Isolated, memoized sidebar — re-renders only when its props or pathname change.
const StudentSidebar = memo(({ fullName, avatarUrl, initials, currentGoal, setCurrentGoal, onLogout, doubtCount, liveCount }: SidebarProps) => {
  const navItems = buildNavItems(doubtCount, liveCount);
  const { pathname } = useLocation();

  const renderItem = (item: StudentNavItem) => {
    const active = pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}
      >
        <item.icon className="h-4.5 w-4.5 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.live && <LiveBadge />}
        {item.badge ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex w-[220px] flex-col border-r border-border bg-card sticky top-0 h-screen overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="p-4 flex justify-center">
        <Link to="/" className="flex items-center justify-center w-full bg-white rounded-xl py-2 px-4 hover:opacity-95 transition-opacity">
          <img src={arkeLogo} alt="ARKE Logo" className="h-10 w-auto object-contain" />
        </Link>
        <div className="mt-4">
          <GoalSelector value={currentGoal} onChange={setCurrentGoal} />
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main</p>
        {navItems.map(renderItem)}
        <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Explore</p>
        {exploreItems.map(renderItem)}
        <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account</p>
        {accountItems.map(renderItem)}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{fullName || "Guest"}</p>
            <Link to="/profile" className="text-[10px] text-primary hover:underline">View Profile</Link>
          </div>
        </div>
        <LogoutButton onConfirm={onLogout} />
      </div>
    </aside>
  );
});
StudentSidebar.displayName = "StudentSidebar";

// Mobile bottom nav — also memoized so it doesn't re-render on every route change beyond active styling.
const StudentMobileNav = memo(() => {
  const { pathname } = useLocation();
  const items = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: BookOpen, label: "Learning", path: "/my-courses" },
    { icon: Video, label: "Live", path: "/my-live-classes" },
    { icon: MessageCircle, label: "Doubts", path: "/doubts" },
    { icon: ClipboardCheck, label: "Tests", path: "/my-tests" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card py-2 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
});
StudentMobileNav.displayName = "StudentMobileNav";

const StudentHeader = memo(({ fullName, avatarUrl }: { fullName: string; avatarUrl?: string }) => (
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
          placeholder="Search courses, tests..."
          className="w-64 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>
    </div>
    <div className="flex items-center gap-3">
      <NotificationBell />
      <Link to="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "U"
        )}
      </Link>
    </div>
  </header>
));
StudentHeader.displayName = "StudentHeader";

const StudentLayout = () => {
  const navigate = useNavigate();
  const { user, currentGoal, setCurrentGoal, notifications } = useAppStore();
  const { signOut } = useAuth();
  useNotifications();
  const { doubts } = useDoubts("mine");
  const pendingDoubtCount = doubts.filter((d) => d.status !== "answered").length;
  const liveUnreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at && (n.type || "").toLowerCase().includes("live_class")).length,
    [notifications],
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login");
  }, [signOut, navigate]);

  const fullName = user?.full_name || "";
  const initials = fullName
    ? fullName.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "U";

  return (
    <div className="flex min-h-screen bg-background">
      <StudentSidebar
        fullName={fullName}
        avatarUrl={user?.avatar_url}
        initials={initials}
        currentGoal={currentGoal}
        setCurrentGoal={setCurrentGoal}
        onLogout={handleLogout}
        doubtCount={pendingDoubtCount}
        liveCount={liveUnreadCount}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader fullName={fullName} avatarUrl={user?.avatar_url} />

        <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Outlet />
        </main>
      </div>

      <StudentMobileNav />
    </div>
  );
};

export default StudentLayout;
