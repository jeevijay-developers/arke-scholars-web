import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import arkeLogo from "@/assets/arke-logo.png";
import {
  LayoutDashboard,
  Flame,
  CircleDot,
  Briefcase,
  Inbox,
  FileText,
  Flag,
  Users,
  GraduationCap,
  Video,
  ClipboardCheck,
  CreditCard,
  Bell,
  Settings,
  ShieldCheck,
  HeartHandshake,
  Library,
  Swords,
  School,
  FileBarChart,
  FileUp,
  Menu,
  X,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";
import { memo, useCallback, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";

type NavItem = { label: string; icon: typeof LayoutDashboard; path: string };

// Items every admin (and super-admin) sees.
const baseNav: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Students", icon: GraduationCap, path: "/admin/students" },
  { label: "Schools", icon: School, path: "/admin/schools" },
  { label: "Mentor Assignments", icon: HeartHandshake, path: "/admin/mentor-assignments" },
  { label: "Mentor Handovers", icon: HeartHandshake, path: "/admin/mentor-handovers" },
  { label: "Courses", icon: GraduationCap, path: "/admin/courses" },
  { label: "Live Classes", icon: Video, path: "/admin/live-classes" },
  { label: "Tests", icon: ClipboardCheck, path: "/admin/tests" },
  { label: "Question Bank", icon: Library, path: "/admin/question-bank" },
  { label: "Upload Test", icon: FileUp, path: "/admin/upload-questions" },
  { label: "Compete Questions", icon: Swords, path: "/admin/compete-questions" },
  { label: "Exam Management", icon: GraduationCap, path: "/admin/exams" },
  { label: "Educator Applications", icon: Briefcase, path: "/admin/educator-applications" },
  { label: "Enquiries", icon: Inbox, path: "/admin/enquiries" },
  { label: "Course Content", icon: FileText, path: "/admin/course-content" },
  { label: "Student Analysis", icon: FileBarChart, path: "/admin/student-reports" },
  { label: "Reports", icon: Flag, path: "/admin/reports" },
  { label: "Notifications", icon: Bell, path: "/admin/notifications" },
];

// Items only super-admin sees: revenue, settings, moderation.
const superAdminNav: NavItem[] = [
  { label: "Admin Management", icon: ShieldCheck, path: "/admin/admins" },
  { label: "Payments & Revenue", icon: CreditCard, path: "/admin/payments" },
  { label: "Moderation", icon: ShieldCheck, path: "/admin/moderation" },
  { label: "Platform Settings", icon: Settings, path: "/admin/settings" },
];

type SidebarProps = {
  email: string;
  initials: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
};

const AdminSidebar = memo(({ email, initials, avatarUrl, isSuperAdmin, onLogout, isOpen, onClose }: SidebarProps) => {
  const { pathname } = useLocation();
  const panelLabel = isSuperAdmin ? "Super Admin Panel" : "Admin Panel";
  const roleLabel = isSuperAdmin ? "Super Admin" : "Admin";

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky left-0 top-0 h-screen w-[240px] flex-col overflow-y-auto scrollbar-hide transition-transform duration-300 lg:transition-none ${
          isOpen ? "translate-x-0 z-40" : "-translate-x-full lg:translate-x-0"
        } hidden lg:flex`}
        style={{ backgroundColor: "hsl(222, 47%, 11%)" }}
      >
      <div className="p-4 flex justify-center">
        <Link to="/" onClick={onClose} className="flex items-center justify-center w-full bg-white rounded-xl py-2 px-4 hover:opacity-95 transition-opacity">
          <img src={arkeLogo} alt="ARKE Logo" className="h-10 w-auto object-contain" />
        </Link>
        {/* <div className="mt-3 rounded-md bg-primary/20 px-2 py-1 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {panelLabel}
          </span>
        </div> */}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Main</p>
        {baseNav.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isSuperAdmin && (
          <>
            <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Super Admin
            </p>
            {superAdminNav.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} alt={initials} className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{email || roleLabel}</p>
            <p className="text-[10px] text-white/50">{roleLabel}</p>
          </div>
        </div>
        <LogoutButton
          onConfirm={onLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        />
      </div>
    </aside>
    </>
  );
});
AdminSidebar.displayName = "AdminSidebar";

const AdminHeader = memo(
  ({ initials, avatarUrl, isSuperAdmin, onLogout, onMenuClick }: { initials: string; avatarUrl?: string; isSuperAdmin: boolean; onLogout: () => void; onMenuClick: () => void }) => (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1 hover:bg-muted rounded-md transition-colors text-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-bold text-foreground">
          ARKE {isSuperAdmin ? "Super Admin" : "Admin"} Dashboard
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-secondary">
          <CircleDot className="h-3 w-3" />
          <span className="font-medium">Connected</span>
        </div>
        <NotificationBell />
        <LogoutButton
          onConfirm={onLogout}
          variant="compact"
          className="lg:hidden flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        />
        <Link
          to="/admin/profile"
          aria-label="My profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity overflow-hidden"
        >
          {avatarUrl ? <img src={avatarUrl} alt={initials} className="h-full w-full object-cover" /> : initials}
        </Link>
      </div>
    </header>
  ),
);
AdminHeader.displayName = "AdminHeader";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, signOut, isSuperAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/admin/login", { replace: true });
  }, [signOut, navigate]);

  const email = user?.email ?? "";
  const initials = useMemo(() => (email || "A").slice(0, 1).toUpperCase(), [email]);
  const storeUser = useAppStore((s) => s.user);
  const avatarUrl = storeUser?.avatar_url;

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        email={email}
        initials={initials}
        avatarUrl={avatarUrl}
        isSuperAdmin={isSuperAdmin}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          initials={initials}
          avatarUrl={avatarUrl}
          isSuperAdmin={isSuperAdmin}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
