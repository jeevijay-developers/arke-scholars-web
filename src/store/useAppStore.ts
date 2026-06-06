import { create } from 'zustand';

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  target_exam: string;
  avatar_url?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  archived_at?: string | null;
}

interface AppState {
  user: AppUser | null;
  notifications: AppNotification[];
  unreadCount: number;
  country: 'india' | 'dubai';
  favouriteIds: Set<string>;
  setUser: (user: AppUser | null) => void;
  setNotifications: (n: AppNotification[]) => void;
  addNotification: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  archiveNotification: (id: string) => void;
  setCountry: (country: 'india' | 'dubai') => void;
  setFavouriteIds: (ids: Set<string>) => void;
  toggleFavouriteId: (courseId: string) => void;
}

const savedCountry = (typeof window !== 'undefined' ? localStorage.getItem('arke-country') : null) as 'india' | 'dubai' | null;

const USER_CACHE_KEY = 'arke-user-cache';
const loadCachedUser = (): AppUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  user: loadCachedUser(),
  notifications: [],
  unreadCount: 0,
  country: savedCountry || 'india',
  favouriteIds: new Set<string>(),
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_CACHE_KEY);
    }
    set({ user });
  },
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.read_at).length }),
  addNotification: (n) => {
    const next = [n, ...get().notifications];
    set({ notifications: next, unreadCount: next.filter((x) => !x.read_at).length });
  },
  markRead: (id) => {
    const next = get().notifications.map((n) =>
      n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
    );
    set({ notifications: next, unreadCount: next.filter((x) => !x.read_at).length });
  },
  markAllRead: () => {
    const now = new Date().toISOString();
    const next = get().notifications.map((n) => (n.read_at ? n : { ...n, read_at: now }));
    set({ notifications: next, unreadCount: 0 });
  },
  archiveNotification: (id) => {
    const next = get().notifications.filter((n) => n.id !== id);
    set({ notifications: next, unreadCount: next.filter((x) => !x.read_at).length });
  },
  setCountry: (country) => {
    localStorage.setItem('arke-country', country);
    set({ country });
  },
  setFavouriteIds: (ids) => set({ favouriteIds: ids }),
  toggleFavouriteId: (courseId) => {
    const next = new Set(get().favouriteIds);
    if (next.has(courseId)) next.delete(courseId);
    else next.add(courseId);
    set({ favouriteIds: next });
  },
}));
