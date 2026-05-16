import { IndianRupee, TrendingUp, ArrowDownLeft, Clock, Download, Loader2, CreditCard, Search, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Payment = {
  id: string;
  user_id: string | null;
  student_name: string | null;
  plan: string | null;
  amount: number;
  currency: string;
  gateway: string;
  external_id: string | null;
  status: string;
  refunded_at: string | null;
  created_at: string;
};

const fmtCurrency = (amount: number, currency: string) => {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  if (currency === "AED") return `AED ${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

const statusBadge = (s: string) => {
  const styles: Record<string, string> = {
    success: "bg-secondary/10 text-secondary",
    pending: "bg-accent/20 text-accent",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${styles[s] ?? "bg-muted text-muted-foreground"}`}>{s}</span>;
};

const exportCsv = (rows: Payment[]) => {
  const header = ["id", "external_id", "student", "plan", "amount", "currency", "gateway", "status", "date"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.id, r.external_id ?? "", r.student_name ?? "", r.plan ?? "", r.amount, r.currency, r.gateway, r.status, r.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      setPayments((data as Payment[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Date-range + search-aware base set (drives stats, chart, table)
  const dateFiltered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const t = new Date(p.created_at).getTime();
      if (fromTs !== null && t < fromTs) return false;
      if (toTs !== null && t > toTs) return false;
      if (q) {
        const hay = `${p.id} ${p.external_id ?? ""} ${p.student_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, fromDate, toDate, search]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const successful = dateFiltered.filter((p) => p.status === "success");
    const totalRevenue = successful.reduce((acc, p) => acc + Number(p.amount), 0);
    const todayRevenue = successful
      .filter((p) => p.created_at.startsWith(today))
      .reduce((acc, p) => acc + Number(p.amount), 0);
    const refunds = dateFiltered
      .filter((p) => p.status === "refunded")
      .reduce((acc, p) => acc + Number(p.amount), 0);
    const pending = dateFiltered
      .filter((p) => p.status === "pending")
      .reduce((acc, p) => acc + Number(p.amount), 0);
    return { totalRevenue, todayRevenue, refunds, pending };
  }, [dateFiltered]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    dateFiltered
      .filter((p) => p.status === "success")
      .forEach((p) => {
        const m = format(new Date(p.created_at), "MMM yy");
        map.set(m, (map.get(m) ?? 0) + Number(p.amount));
      });
    return Array.from(map.entries()).map(([month, revenue]) => ({ month, revenue }));
  }, [dateFiltered]);

  const filtered = filter === "all" ? dateFiltered : dateFiltered.filter((t) => t.status === filter);

  const hasActiveFilters = fromDate || toDate || search;
  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setSearch("");
  };

  const stats_cards = [
    { label: "Total Revenue", value: fmtCurrency(stats.totalRevenue, "INR"), icon: IndianRupee, color: "text-secondary" },
    { label: "Today", value: fmtCurrency(stats.todayRevenue, "INR"), icon: TrendingUp, color: "text-primary" },
    { label: "Refunds", value: fmtCurrency(stats.refunds, "INR"), icon: ArrowDownLeft, color: "text-destructive" },
    { label: "Pending", value: fmtCurrency(stats.pending, "INR"), icon: Clock, color: "text-accent" },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction ID, student or external ID…"
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex flex-col">
              <label className="text-[10px] font-medium text-muted-foreground mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-medium text-muted-foreground mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
        {stats_cards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 hover-lift">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
        <h2 className="text-sm font-bold text-foreground mb-4">Monthly Revenue</h2>
        {monthly.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No revenue data yet — once payment gateways are connected, monthly trends will appear here.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215,16%,47%)" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(215,16%,47%)" tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="hsl(24,95%,53%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 animate-fade-in-up">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-foreground">Transactions</h2>
          <div className="flex gap-2">
            {["all", "success", "failed", "refunded", "pending"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"}`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[10px] font-medium text-muted-foreground disabled:opacity-50"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground">
              Once Razorpay (India) or Stripe (Dubai) payments are wired in, every successful, failed or refunded charge will land here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">ID</th>
                  <th className="text-left py-2 font-medium">Student</th>
                  <th className="text-left py-2 font-medium hidden sm:table-cell">Plan</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium hidden md:table-cell">Gateway</th>
                  <th className="text-left py-2 font-medium hidden lg:table-cell">Date</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 font-mono text-muted-foreground">{t.external_id ?? t.id.slice(0, 8)}</td>
                    <td className="py-2.5 font-medium text-foreground">{t.student_name ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{t.plan ?? "—"}</td>
                    <td className="py-2.5 text-right font-medium text-foreground">{fmtCurrency(Number(t.amount), t.currency)}</td>
                    <td className="py-2.5 text-muted-foreground hidden md:table-cell capitalize">{t.gateway}</td>
                    <td className="py-2.5 text-muted-foreground hidden lg:table-cell">{format(new Date(t.created_at), "dd MMM yy")}</td>
                    <td className="py-2.5">{statusBadge(t.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
