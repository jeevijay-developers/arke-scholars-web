import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";

export type UserRole = "student" | "teacher" | "mentor" | "admin" | "super_admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /**
   * True if the user can access the admin portal (admin OR super_admin).
   * Kept for backwards compatibility with existing route guards.
   */
  isStaff: boolean;
  /** True if the user has super_admin role (top tier — revenue, settings, refunds). */
  isSuperAdmin: boolean;
  /** True if the user is an admin (but not super_admin). */
  isAdmin: boolean;
  /** True if the user has the 'teacher' role. */
  isTeacher: boolean;
  /** True if the user has the 'mentor' role. */
  isMentor: boolean;
  /** True if the user has no elevated role (default student). */
  isStudent: boolean;
  /** The resolved primary role of the current user, or null when signed out. */
  role: UserRole | null;
  /**
   * True once we've finished resolving the user's role from the server for the
   * current session. Use this in route guards to avoid flickering or wrong
   * redirects while role data is still loading.
   */
  roleReady: boolean;

  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /**
   * Re-checks the user's role against the server (user_roles table via has_role
   * RPCs). Returns true if the current user has staff or admin privileges.
   * Resolves to false if there is no active session.
   */
  refreshRole: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const setStoreUser = useAppStore((s) => s.setUser);
  const setStoreGoal = useAppStore((s) => s.setCurrentGoal);
  // Track which user we last resolved a role for to avoid stale writes when
  // multiple sign-in events fire in quick succession.
  const lastRoleUserId = useRef<string | null>(null);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "super_admin" || role === "lead_manager";
  const isTeacher = role === "teacher";
  const isMentor = role === "mentor";
  const isStudent = role === "student";

  /**
   * Server-verified role check. Calls the `has_role` security-definer RPC for
   * each elevated role so the answer comes from the database. Defaults to
   * 'student' when none of the elevated roles match.
   */
  const resolveRoleFromServer = useCallback(async (userId: string): Promise<UserRole> => {
    try {
      const [superRes, adminRes, teacherRes, mentorRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "teacher" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
      ]);
      if (superRes.data) return "super_admin";
      if (adminRes.data) return "admin";
      if (teacherRes.data) return "teacher";
      if (mentorRes.data) return "mentor";
      return "student";
    } catch (err) {
      console.error("Failed to resolve role:", err);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role as UserRole);
      if (roles.includes("super_admin")) return "super_admin";
      if (roles.includes("admin")) return "admin";
      if (roles.includes("teacher")) return "teacher";
      if (roles.includes("mentor")) return "mentor";
      return "student";
    }
  }, []);

  const checkRole = useCallback(
    async (userId: string): Promise<boolean> => {
      lastRoleUserId.current = userId;
      const resolved = await resolveRoleFromServer(userId);
      if (lastRoleUserId.current !== userId) {
        return resolved === "admin" || resolved === "super_admin";
      }
      setRole(resolved);
      setRoleReady(true);
      return resolved === "admin" || resolved === "super_admin";
    },
    [resolveRoleFromServer],
  );

  const loadProfile = async (authUser: User) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, target_exam, goal")
      .eq("user_id", authUser.id)
      .maybeSingle();

    const fallbackName =
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      authUser.email?.split("@")[0] ||
      "Student";

    setStoreUser({
      id: authUser.id,
      full_name: profile?.full_name?.trim() || fallbackName,
      email: authUser.email || "",
      role: "student",
      target_exam: profile?.target_exam || "",
      avatar_url: profile?.avatar_url || (authUser.user_metadata?.avatar_url as string | undefined),
    });

    if (profile?.goal) setStoreGoal(profile.goal);
  };

  const refreshProfile = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) await loadProfile(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshRole = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      lastRoleUserId.current = null;
      setRole(null);
      setRoleReady(true);
      return false;
    }
    return checkRole(u.id);
  }, [checkRole]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      const newUserId = newSession?.user?.id ?? null;

      // Ignore token refreshes / tab-focus re-emits for the same user — they
      // would otherwise reset roleReady and trigger a full-screen loader,
      // which looks like a "reload" when switching browser tabs.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      if (newUserId && newUserId === lastRoleUserId.current) return;

      if (newSession?.user) {
        setRoleReady(false);
        setTimeout(() => {
          checkRole(newSession.user.id);
          loadProfile(newSession.user);
        }, 0);
      } else {
        lastRoleUserId.current = null;
        setRole(null);
        setRoleReady(true);
        setStoreUser(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        Promise.all([checkRole(existing.user.id), loadProfile(existing.user)]).finally(() =>
          setLoading(false),
        );
      } else {
        setRoleReady(true);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      // Block suspended accounts at sign-in time.
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_suspended")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (prof?.is_suspended) {
        await supabase.auth.signOut();
        return { error: "Your account has been blocked. Please contact a super admin." };
      }
      await checkRole(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStoreUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isStaff,
        isSuperAdmin,
        isAdmin,
        isTeacher,
        isMentor,
        isStudent,
        role,
        roleReady,
        loading,
        signIn,
        signOut,
        refreshProfile,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
