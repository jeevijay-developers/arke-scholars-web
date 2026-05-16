import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import { markAllNotificationsRead, markNotificationRead } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const NotificationBell = () => {
  const { user } = useAuth();
  const { notifications, unreadCount } = useAppStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = async (id: string, link: string | null) => {
    await markNotificationRead(id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-background transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-elevated animate-fade-in-up flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold font-display text-foreground">Notifications</p>
            {unreadCount > 0 && user && (
              <button
                onClick={() => markAllNotificationsRead(user.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
              </div>
            )}
            {notifications.slice(0, 10).map((n) => {
              const unread = !n.read_at;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.link)}
                  className={`w-full text-left border-b border-border px-4 py-3 hover:bg-background/50 transition-colors ${
                    unread ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!unread && <Check className="h-3 w-3 text-muted-foreground/50 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="border-t border-border px-4 py-2.5 text-center text-xs font-bold text-primary hover:bg-background/50 transition-colors"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
