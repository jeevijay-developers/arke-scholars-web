import { useMemo, useState } from "react";
import { Bell, CheckCheck, Archive, MessageCircle, Calendar, CreditCard, Sparkles, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/context/AuthContext";
import {
  archiveNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/hooks/useNotifications";
import { format, isThisWeek, isToday, isYesterday } from "date-fns";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mentor", label: "Mentor" },
  { id: "doubt", label: "Doubts" },
  { id: "live_class", label: "Classes" },
  { id: "course", label: "Courses" },
] as const;

const iconForType = (type: string) => {
  if (type.includes("mentor")) return MessageCircle;
  if (type.includes("doubt")) return Sparkles;
  if (type.includes("live")) return Calendar;
  if (type.includes("payment") || type.includes("course")) return CreditCard;
  return BookOpen;
};

const groupKey = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "This week";
  return format(d, "MMMM yyyy");
};

const NotificationsPage = () => {
  const { user } = useAuth();
  const { notifications, unreadCount } = useAppStore();
  const [filter, setFilter] = useState<(typeof TYPE_FILTERS)[number]["id"]>("all");
  const navigate = useNavigate();

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read_at);
    return notifications.filter((n) => n.type?.toLowerCase().includes(filter));
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visible>();
    visible.forEach((n) => {
      const key = groupKey(n.created_at);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto pb-20 lg:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black font-display text-foreground lg:text-2xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && user && (
          <button
            onClick={() => markAllNotificationsRead(user.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-background transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-pill px-4 py-1.5 text-xs font-bold transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No notifications</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([label, items]) => (
            <section key={label}>
              <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {items.map((n) => {
                  const unread = !n.read_at;
                  const Icon = iconForType(n.type || "");
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 border-b border-border last:border-0 px-4 py-3.5 transition-colors ${
                        unread ? "bg-primary/5" : ""
                      }`}
                    >
                      <button
                        onClick={async () => {
                          await markNotificationRead(n.id);
                          if (n.link) navigate(n.link);
                        }}
                        className="flex flex-1 items-start gap-3 text-left min-w-0"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            unread ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(n.created_at), "h:mm a")}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => archiveNotification(n.id)}
                        title="Archive"
                        className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
