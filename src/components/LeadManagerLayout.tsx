import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import favicon from "@/assets/favicon.png";

const NAV = [
  { label: "Overview", icon: LayoutDashboard, path: "/lead-manager/dashboard" },
  { label: "Student Leads", icon: Users, path: "/lead-manager/leads" },
];

export default function LeadManagerLayout() {
  const { signOut } = useAuth();
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:sticky top-0 z-40 inset-y-0 left-0 w-64 h-screen bg-white border-r border-slate-200 flex flex-col transition-transform duration-200`}
      >
        {/* Header */}
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="">
              <img src={favicon} alt="Arke Scholars" className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">Arke Scholars</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Lead Manager</div>
            </div>
          </div>
          <button className="md:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setOpen(false)}>
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Menu</div>
          {NAV.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-accent to-primary text-white shadow-md shadow-blue"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user?.full_name || user?.email || "L").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{user?.full_name || "Lead Manager"}</div>
              <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 py-3 flex items-center gap-3 md:hidden">
          <button
            className="p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-slate-900">Lead Manager</span>
        </header>

        <main className="flex-1 min-w-0 overflow-x-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
