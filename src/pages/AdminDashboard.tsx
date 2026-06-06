import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users, IndianRupee, BookOpen, Target, ArrowRight, Loader2, Inbox, Briefcase, Flag,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { formatDistanceToNow, format, subDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = { user_id: string; full_name: string | null; created_at: string; country: string | null };
type CourseRow = { id: string; name: string; educator_name: string; total_enrolled: number | null; rating: number | null; price: number };
type EnrollmentRow = { id: string; course_id: string; created_at: string };
type LiveClassRow = { id: string; title: string; educator_name: string; status: string; starts_at: string };
type TestAttemptRow = { id: string; created_at: string };


const fetchDashboard = async () => {
  const todayStart = startOfDay(new Date()).toISOString();
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const [
    profilesRes, coursesRes, enrollmentsRes, liveRes, attemptsRes, eduRes, enqRes, repRes,
  ] = await Promise.all([
    supabase.from("profiles")
      .select("user_id, full_name, created_at, country")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("courses")
      .select("id, name, educator_name, total_enrolled, rating, price")
      .eq("is_published", true),
    supabase.from("enrollments")
      .select("id, course_id, created_at")
      .gte("created_at", thirtyDaysAgo),
    supabase.from("live_classes")
      .select("id, title, educator_name, status, starts_at")
      .in("status", ["live", "scheduled"])
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase.from("test_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase.from("educator_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase.from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return {
    profiles: (profilesRes.data ?? []) as ProfileRow[],
    courses: (coursesRes.data ?? []) as CourseRow[],
    enrollments: (enrollmentsRes.data ?? []) as EnrollmentRow[],
    liveClasses: (liveRes.data ?? []) as LiveClassRow[],
    testAttemptsToday: attemptsRes.count ?? 0,
    pending: {
      educators: eduRes.count ?? 0,
      enquiries: enqRes.count ?? 0,
      reports: repRes.count ?? 0,
    },
  };
};

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const profiles = data?.profiles ?? [];
  const courses = data?.courses ?? [];
  const enrollments = data?.enrollments ?? [];
  const liveClasses = data?.liveClasses ?? [];
  const testAttemptsToday = data?.testAttemptsToday ?? 0;
  const pending = data?.pending ?? { educators: 0, enquiries: 0, reports: 0 };
  const loading = isLoading;

  // Derived stats
  const newUsersToday = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    return profiles.filter((p) => new Date(p.created_at).getTime() >= todayStart).length;
  }, [profiles]);

  const monthlyRevenue = useMemo(() => {
    const courseById = new Map(courses.map((c) => [c.id, c]));
    return enrollments.reduce((sum, e) => sum + Number(courseById.get(e.course_id)?.price ?? 0), 0);
  }, [enrollments, courses]);

  const formatINR = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
  };

  const stats = [
    { label: "Total Users", value: profiles.length.toLocaleString(), icon: Users, change: `+${newUsersToday} today`, color: "text-primary" },
    { label: "Monthly Revenue", value: formatINR(monthlyRevenue), icon: IndianRupee, change: `${enrollments.length} enrollments / 30d`, color: "text-secondary" },
    { label: "Active Courses", value: courses.length.toString(), icon: BookOpen, change: `${courses.reduce((s, c) => s + (c.total_enrolled ?? 0), 0)} learners`, color: "text-primary" },
    { label: "Tests Today", value: testAttemptsToday.toLocaleString(), icon: Target, change: "Attempts since 00:00", color: "text-accent" },
  ];

  // Revenue per day (last 30 days), based on enrollments * course price
  const revenueData = useMemo(() => {
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd MMM");
      buckets[d] = 0;
    }
    enrollments.forEach((e) => {
      const key = format(new Date(e.created_at), "dd MMM");
      if (key in buckets) buckets[key] += Number(courseById.get(e.course_id)?.price ?? 0);
    });
    return Object.entries(buckets).map(([day, revenue]) => ({ day, revenue }));
  }, [enrollments, courses]);

  const recentUsers = profiles.slice(0, 5);

  const topCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => (b.total_enrolled ?? 0) - (a.total_enrolled ?? 0))
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        name: c.name,
        teacher: c.educator_name,
        enrolled: c.total_enrolled ?? 0,
        revenue: formatINR((c.total_enrolled ?? 0) * Number(c.price ?? 0)),
        rating: Number(c.rating ?? 0).toFixed(1),
      }));
  }, [courses]);

  const liveNow = liveClasses.filter((c) => c.status === "live");
  const upcoming = liveClasses.filter((c) => c.status === "scheduled").slice(0, 5);

  const regionData = useMemo(() => {
    const counts: Record<string, number> = { India: 0, Dubai: 0, Other: 0 };
    profiles.forEach((p) => {
      const c = (p.country ?? "").toLowerCase();
      if (c.includes("india") || c === "in") counts.India++;
      else if (c.includes("dubai") || c.includes("uae") || c === "ae") counts.Dubai++;
      else counts.Other++;
    });
    const total = Math.max(1, profiles.length);
    return [
      { name: "India", value: Math.round((counts.India / total) * 100), color: "hsl(24,95%,53%)" },
      { name: "Dubai", value: Math.round((counts.Dubai / total) * 100), color: "hsl(160,93%,39%)" },
      { name: "Other", value: Math.round((counts.Other / total) * 100), color: "hsl(220,14%,90%)" },
    ];
  }, [profiles]);

  const approvals = [
    { label: "Educator applications", count: pending.educators, link: "/admin/educator-applications" },
    { label: "New enquiries", count: pending.enquiries, link: "/admin/enquiries" },
    { label: "Reported content", count: pending.reports, link: "/admin/reports" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 hover-lift">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{s.change}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
        <h2 className="text-sm font-bold text-foreground mb-4">Revenue — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(215,16%,47%)" interval={4} />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(215,16%,47%)" tickFormatter={(v) => formatINR(v)} />
            <Tooltip formatter={(v: number) => [formatINR(v), "Revenue"]} />
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(24,95%,53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(24,95%,53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="revenue" stroke="hsl(24,95%,53%)" fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent users */}
          <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Recent Users</h2>
              <Link to="/admin/educator-applications" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No users yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">Name</th>
                      <th className="text-left py-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr key={u.user_id} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-medium text-foreground">{u.full_name || "Unnamed user"}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top courses */}
          <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
            <h2 className="text-sm font-bold text-foreground mb-3">Top Courses</h2>
            {topCourses.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No courses yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">#</th>
                      <th className="text-left py-2 font-medium">Course</th>
                      <th className="text-left py-2 font-medium">Teacher</th>
                      <th className="text-right py-2 font-medium">Enrolled</th>
                      <th className="text-right py-2 font-medium">Revenue</th>
                      <th className="text-right py-2 font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCourses.map((c) => (
                      <tr key={c.rank} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-bold text-muted-foreground">{c.rank}</td>
                        <td className="py-2.5 font-medium text-foreground">{c.name}</td>
                        <td className="py-2.5 text-muted-foreground">{c.teacher}</td>
                        <td className="py-2.5 text-right text-foreground">{c.enrolled}</td>
                        <td className="py-2.5 text-right text-secondary font-medium">{c.revenue}</td>
                        <td className="py-2.5 text-right text-accent font-medium">{c.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Live now */}
          <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
            <h2 className="text-sm font-bold text-foreground mb-3">
              Currently Live: {liveNow.length} {liveNow.length === 1 ? "class" : "classes"}
            </h2>
            {liveNow.length === 0 && upcoming.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No live or upcoming classes.</p>
            ) : (
              <div className="space-y-2">
                {liveNow.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover-lift">
                    <div className="flex h-2.5 w-2.5 rounded-full bg-destructive animate-live-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground">{c.educator_name}</p>
                    </div>
                    <span className="text-[10px] font-bold text-destructive">LIVE</span>
                  </div>
                ))}
                {upcoming.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground">{c.educator_name}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(c.starts_at), "dd MMM, HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending approvals */}
          <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
            <h2 className="text-sm font-bold text-foreground mb-3">Pending Approvals</h2>
            <div className="space-y-2">
              {approvals.map((a) => {
                const Icon = a.label.includes("Educator") ? Briefcase : a.label.includes("enquiries") ? Inbox : Flag;
                return (
                  <Link
                    key={a.label}
                    to={a.link}
                    className="flex items-center justify-between rounded-lg bg-background px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs text-foreground">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.label}
                    </span>
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${a.count > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {a.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Region breakdown */}
          <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
            <h2 className="text-sm font-bold text-foreground mb-3">Region Breakdown</h2>
            {profiles.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No user data yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={regionData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {regionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {regionData.map((r) => (
                    <div key={r.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-[10px] text-muted-foreground">{r.name} ({r.value}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
