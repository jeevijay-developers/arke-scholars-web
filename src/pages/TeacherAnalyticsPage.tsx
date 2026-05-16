import { BarChart3, Users, DollarSign, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useTeacherAnalytics } from "@/hooks/useTeacherAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

const formatINR = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString()}`;
};

const TeacherAnalyticsPage = () => {
  const a = useTeacherAnalytics();
  const stats = [
    { label: "Total Students", value: a.totalStudents.toLocaleString(), icon: Users, color: "from-blue-500 to-blue-600" },
    { label: "Est. Revenue", value: a.totalRevenue > 0 ? formatINR(a.totalRevenue) : "—", icon: DollarSign, color: "from-green-500 to-green-600" },
    { label: "Lecture Views", value: a.lectureViews.toLocaleString(), icon: Eye, color: "from-purple-500 to-purple-600" },
    { label: "Avg Test Score", value: a.avgTestScore > 0 ? `${a.avgTestScore}%` : "—", icon: BarChart3, color: "from-primary to-accent" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <h1 className="text-2xl font-black font-display">Analytics</h1>
        <p className="text-white/90 text-sm mt-1">Track your teaching impact — live data from your students</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} text-white`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            {a.loading ? <Skeleton className="h-7 w-16" /> : <p className="text-xl font-black text-foreground">{s.value}</p>}
            {s.label === "Est. Revenue" && a.totalRevenue > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Gross, before fees</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Student Engagement (Last 7 Days)</h3>
          {a.loading ? (
            <Skeleton className="h-56 w-full" />
          ) : a.engagement.every((d) => d.views === 0 && d.doubts === 0) ? (
            <p className="text-xs text-muted-foreground py-12 text-center">No activity in the last 7 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={a.engagement}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Views" />
                <Bar dataKey="doubts" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Doubts" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Estimated Revenue (6 Months)</h3>
          {a.loading ? (
            <Skeleton className="h-56 w-full" />
          ) : a.revenue.every((m) => m.revenue === 0) ? (
            <p className="text-xs text-muted-foreground py-12 text-center">No enrollment revenue yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={a.revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatINR} />
                <Tooltip formatter={(v: number) => [formatINR(v), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Course Distribution</h3>
          {a.loading ? (
            <Skeleton className="h-56 w-full" />
          ) : a.courseDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground py-12 text-center">No enrolled courses yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={a.courseDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {a.courseDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Top Performing Students</h3>
          {a.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : a.topStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No test attempts yet.</p>
          ) : (
            <div className="space-y-3">
              {a.topStudents.map((s, i) => (
                <div key={s.name + i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {s.initials}
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                  <span className="text-sm font-bold text-secondary">{s.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherAnalyticsPage;
