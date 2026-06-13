import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, MessageCircle, Swords, BarChart3, Trophy, User, Settings, Search, Users, LogOut, Flame, Store } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { memo, useCallback, useMemo, useRef, useState, useEffect } from "react";
import arkeLogo from "@/assets/arke-logo.png";
import LiveBadge from "@/components/LiveBadge";
import NotificationBell from "@/components/NotificationBell";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useDoubts } from "@/hooks/useDoubts";
import { useLiveClasses } from "@/hooks/useLiveClasses";
import { toast } from "sonner";

type StudentNavItem = {
  label: string;
  icon: React.ElementType;
  path: string;
  live?: boolean;
  badge?: number;
  flame?: boolean;
};

const buildNavItems = (doubtCount: number): StudentNavItem[] => [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "My Learning", icon: BookOpen, path: "/my-courses" },
  { label: "Compete", icon: Swords, path: "/compete", flame: true },
  { label: "Doubts", icon: MessageCircle, path: "/doubts", badge: doubtCount || undefined },
  { label: "Mentor Chat", icon: Users, path: "/mentor-chat" },
];

const dropdownItems = [
  { label: "Profile", icon: User, path: "/profile" },
  { label: "My Analytics", icon: BarChart3, path: "/analytics" },
  { label: "Leaderboard", icon: Trophy, path: "/leaderboard" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

type AvatarDropdownProps = {
  fullName: string;
  avatarUrl?: string;
  initials: string;
  onLogout: () => void;
  navItems?: StudentNavItem[];
};

const AvatarDropdown = memo(({ fullName, avatarUrl, initials, onLogout, navItems }: AvatarDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : initials}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-border bg-card shadow-lg py-1.5">
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-xs font-semibold text-foreground truncate">{fullName || "Student"}</p>
          </div>
          {navItems && navItems.length > 0 && (
            <>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.flame && <Flame className="h-3 w-3 text-orange-500 shrink-0" />}
                  {item.badge ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
              <div className="border-t border-border my-1" />
            </>
          )}
          {dropdownItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
AvatarDropdown.displayName = "AvatarDropdown";

type SidebarProps = {
  fullName: string;
  avatarUrl?: string;
  initials: string;
  onLogout: () => void;
  doubtCount: number;
};

// Isolated, memoized sidebar — re-renders only when its props or pathname change.
const StudentSidebar = memo(({ fullName, avatarUrl, initials, onLogout, doubtCount }: SidebarProps) => {
  const navItems = buildNavItems(doubtCount);
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
        {item.flame && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
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
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main</p>
        {navItems.map(renderItem)}
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
          </div>
        </div>
        <LogoutButton onConfirm={onLogout} />
      </div>
    </aside>
  );
});
StudentSidebar.displayName = "StudentSidebar";

// Mobile bottom nav — floating card with special elevated Compete center button
const StudentMobileNav = memo(() => {
  const { pathname } = useLocation();

  const sideItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: BookOpen, label: "My Courses", path: "/my-courses" },
    // center slot reserved for Compete
    { icon: Store, label: "Store", path: "/explore-courses" },
    { icon: MessageCircle, label: "Doubts", path: "/doubts" },
  ];

  const competeActive = pathname === "/compete" || pathname.startsWith("/compete/");

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-40 lg:hidden flex items-end justify-around bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-border/20 px-1 pt-1.5 pb-1.5">
      {/* Left two items */}
      {sideItems.slice(0, 2).map((item) => {
        const active = pathname === item.path || pathname.startsWith(item.path + "/");
        return (
          <Link key={item.path} to={item.path} className="flex flex-col items-center gap-0.5 px-2">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-150 ${active ? "bg-orange-500" : ""}`}>
              <item.icon className={`h-5 w-5 transition-colors duration-150 ${active ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <span className={`text-[10px] font-semibold transition-colors duration-150 ${active ? "text-orange-500" : "text-muted-foreground"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Center — Compete special button */}
      <Link
        to="/compete"
        className="flex flex-col items-center gap-1 px-2 -mt-5"
      >
        <div className={`flex items-center justify-center w-14 h-14 rounded-full shadow-md transition-all duration-150 ${competeActive ? "bg-orange-600 scale-105" : "bg-orange-500"}`}>
          <Trophy className="h-7 w-7 text-white" />
        </div>
        <span className={`text-[10px] font-semibold transition-colors duration-150 ${competeActive ? "text-orange-600" : "text-orange-500"}`}>
          Compete
        </span>
      </Link>

      {/* Right two items */}
      {sideItems.slice(2).map((item) => {
        const active = pathname === item.path || pathname.startsWith(item.path + "/");
        return (
          <Link key={item.path} to={item.path} className="flex flex-col items-center gap-0.5 px-2">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-150 ${active ? "bg-orange-500" : ""}`}>
              <item.icon className={`h-5 w-5 transition-colors duration-150 ${active ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <span className={`text-[10px] font-semibold transition-colors duration-150 ${active ? "text-orange-500" : "text-muted-foreground"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
});
StudentMobileNav.displayName = "StudentMobileNav";

const StudentLayout = () => {
  const navigate = useNavigate();
  const { user, notifications } = useAppStore();
  const { signOut } = useAuth();
  useNotifications();
  const { doubts } = useDoubts("mine");
  const { classes: liveClasses } = useLiveClasses("live");
  const hasLive = liveClasses.length > 0;
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

  const navItems = buildNavItems(pendingDoubtCount);

  // suppress unused var warning — hasLive kept for future use
  void hasLive;
  void liveUnreadCount;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <StudentSidebar
        fullName={fullName}
        avatarUrl={user?.avatar_url}
        initials={initials}
        onLogout={handleLogout}
        doubtCount={pendingDoubtCount}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-4 py-3 lg:px-6">
          {/* Mobile: logo left, icons right */}
          <div className="flex items-center gap-3 lg:hidden w-full">
            <div className="flex-1 flex justify-start">
              <Link to="/">
                <div className="bg-white rounded-lg p-1 flex items-center justify-center">
                  <img src={arkeLogo} alt="ARKE Logo" className="h-9 w-auto object-contain" />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <AvatarDropdown
                fullName={fullName}
                avatarUrl={user?.avatar_url}
                initials={fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "U"}
                onLogout={handleLogout}
                navItems={navItems}
              />
            </div>
          </div>
          {/* Desktop: search left, icons right */}
          <div className="hidden lg:flex items-center justify-between w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses, tests..."
                className="w-64 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <AvatarDropdown
                fullName={fullName}
                avatarUrl={user?.avatar_url}
                initials={initials}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Outlet />
        </main>
      </div>

      <StudentMobileNav />
    </div>
  );
};

export default StudentLayout;
