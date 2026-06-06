import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Users, Search, Phone, MessageCircle, Trash2,
  TrendingUp, UserPlus, PhoneCall, GraduationCap,
  Sparkles, ChevronRight, CalendarDays, X, ListFilter,
} from "lucide-react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// leads table is not in the generated Database types (it's owned by the landing-page).
// Cast once here so all .from("leads") calls below are untyped without per-call casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  board: string | null;
  medium: string | null;
  status: string;
  notes: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  enrolled?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: { value: string; label: string }[] = [
  { value: "new",             label: "New" },
  { value: "call_not_picked", label: "Call not Picked" },
  { value: "not_interested",  label: "Not Interested" },
  { value: "wrong_number",    label: "Wrong Number" },
  { value: "not_reachable",   label: "Not Reachable" },
  { value: "not_student",     label: "Not Student" },
  { value: "connected",       label: "Connected" },
];

const STATUS_STYLES: Record<string, string> = {
  new:             "bg-amber-50 text-amber-700 border-amber-200",
  call_not_picked: "bg-orange-50 text-orange-700 border-orange-200",
  not_interested:  "bg-slate-100 text-slate-600 border-slate-200",
  wrong_number:    "bg-red-50 text-red-700 border-red-200",
  not_reachable:   "bg-pink-50 text-pink-700 border-pink-200",
  not_student:     "bg-gray-100 text-gray-600 border-gray-200",
  connected:       "bg-blue-50 text-blue-700 border-blue-200",
  enrolled:        "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusLabel(value: string) {
  if (value === "enrolled") return "Enrolled";
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.new;
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
      {getStatusLabel(status)}
    </span>
  );
}

// ─── Inline Note Cell ─────────────────────────────────────────────────────────

function NoteCell({ lead, onSave }: { lead: Lead; onSave: (id: string, note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lead.notes ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value !== (lead.notes ?? "")) onSave(lead.id, value);
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } }}
        rows={2}
        className="w-full min-w-[160px] text-xs border border-[#f97015] rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-100 bg-orange-50/20"
        placeholder="Write a note… (Enter to save)"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left w-full min-w-[160px] text-xs px-2.5 py-1.5 rounded-lg border border-[#f97015]/40 bg-orange-50/40 hover:border-[#f97015] hover:bg-orange-50 transition-colors min-h-[34px]"
      title="Click to add/edit note"
    >
      {value ? (
        <span className="text-slate-700 whitespace-pre-wrap line-clamp-2">{value}</span>
      ) : (
        <span className="text-[#f97015]/50 italic">Add note…</span>
      )}
    </button>
  );
}

// ─── Date Filter Popover ──────────────────────────────────────────────────────

type DateFilter = { from: string; to: string };

function DateFilterButton({
  filter, onChange,
}: {
  filter: DateFilter;
  onChange: (f: DateFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filter.from);
  const [to, setTo] = useState(filter.to);
  const active = filter.from || filter.to;

  const apply = () => {
    onChange({ from, to });
    setOpen(false);
  };
  const clear = () => {
    setFrom(""); setTo("");
    onChange({ from: "", to: "" });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition-colors ${
          active
            ? "border-[#f97015] bg-orange-50 text-[#f97015]"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        {active ? `${filter.from || "…"} → ${filter.to || "…"}` : "Date"}
        {active && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="ml-1 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter by Submitted Date</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:border-[#f97015] focus:ring-2 focus:ring-orange-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:border-[#f97015] focus:ring-2 focus:ring-orange-100 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={apply}
              className="flex-1 h-9 bg-[#f97015] text-white text-sm font-semibold rounded-lg hover:bg-[#d95e05] transition-colors"
            >
              Apply
            </button>
            <button
              onClick={clear}
              className="flex-1 h-9 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status Filter Button ────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: "",               label: "All Statuses" },
  { value: "new",            label: "New" },
  { value: "call_not_picked",label: "Call not Picked" },
  { value: "not_interested", label: "Not Interested" },
  { value: "wrong_number",   label: "Wrong Number" },
  { value: "not_reachable",  label: "Not Reachable" },
  { value: "not_student",    label: "Not Student" },
  { value: "connected",      label: "Connected" },
  { value: "enrolled",       label: "Enrolled" },
];

function StatusFilterButton({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";
  const activeLabel = STATUS_FILTER_OPTIONS.find((o) => o.value === value)?.label;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition-colors ${
          active
            ? "border-[#f97015] bg-orange-50 text-[#f97015]"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
      >
        <ListFilter className="w-4 h-4" />
        {active ? activeLabel : "Sort by Status"}
        {active && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="ml-1 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 w-52 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-1.5">Filter by Status</p>
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                value === opt.value
                  ? "bg-orange-50 text-[#f97015] font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <span className="w-2 h-2 rounded-full bg-[#f97015]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ leads, onGoLeads }: { leads: Lead[]; onGoLeads: () => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const newToday  = leads.filter((l) => new Date(l.created_at) >= today).length;
  const newCount  = leads.filter((l) => l.status === "new").length;
  const contacted = leads.filter((l) => l.status === "connected").length;
  const enrolled  = leads.filter((l) => l.enrolled).length;
  const conversionRate = leads.length ? Math.round((enrolled / leads.length) * 100) : 0;

  const cards = [
    { label: "Total Leads",      value: leads.length, icon: Users,         bg: "bg-orange-50",  iconColor: "text-[#f97015]" },
    { label: "New Today",        value: newToday,     icon: Sparkles,      bg: "bg-blue-50",    iconColor: "text-blue-600" },
    { label: "Awaiting Contact", value: newCount,     icon: UserPlus,      bg: "bg-amber-50",   iconColor: "text-amber-600" },
    { label: "Connected",        value: contacted,    icon: PhoneCall,     bg: "bg-violet-50",  iconColor: "text-violet-600" },
    { label: "Enrolled",         value: enrolled,     icon: GraduationCap, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6 max-w-7xl p-4 md:p-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f97015] via-[#f97015] to-[#d95e05] p-6 md:p-8 text-white shadow-xl shadow-orange-500/20">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-3">
              <TrendingUp className="w-3.5 h-3.5" /> {conversionRate}% conversion rate
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Student Leads Dashboard</h2>
            <p className="text-sm md:text-base text-white/85 mt-1">
              You have <span className="font-semibold">{newCount}</span> new lead{newCount === 1 ? "" : "s"} waiting to be contacted.
            </p>
          </div>
          <button
            onClick={onGoLeads}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#f97015] text-sm font-semibold hover:bg-orange-50 transition-colors w-fit"
          >
            View All Leads <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 border border-slate-200 hover:shadow-md transition-all">
            <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon className={`w-5 h-5 ${c.iconColor}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Submissions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest leads from the landing page</p>
          </div>
          <button onClick={onGoLeads} className="text-xs font-semibold text-[#f97015] hover:text-[#d95e05] inline-flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {leads.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No leads yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f97015] to-[#d95e05] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {l.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 truncate">{l.name}</div>
                  <div className="text-xs text-slate-500 truncate">+91 {l.phone} · {l.city || "—"}</div>
                </div>
                <StatusBadge status={l.enrolled ? "enrolled" : l.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab({
  leads, total, loading, search, setSearch,
  statusFilter, setStatusFilter,
  dateFilter, setDateFilter,
  onStatusChange, onEnrolledToggle, onNoteChange, onDelete,
}: {
  leads: Lead[]; total: number; loading: boolean;
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  dateFilter: DateFilter; setDateFilter: (f: DateFilter) => void;
  onStatusChange: (id: string, status: string) => void;
  onEnrolledToggle: (id: string, enrolled: boolean) => void;
  onNoteChange: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">All Leads</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage and contact student enquiries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search — name / phone / city / UTM */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, city, Meta, Google…"
              className="w-full sm:w-80 h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-white text-sm focus:border-[#f97015] focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
            />
          </div>

          {/* Sort by Status */}
          <StatusFilterButton value={statusFilter} onChange={setStatusFilter} />

          {/* Date filter */}
          <DateFilterButton filter={dateFilter} onChange={setDateFilter} />

          {/* Count badge */}
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap bg-white border border-slate-200 px-3 py-2 rounded-xl">
            {leads.length} / {total}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <div className="w-4 h-4 border-2 border-[#f97015] border-t-transparent rounded-full animate-spin" />
            Loading leads…
          </div>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-[#f97015]" />
          </div>
          <h3 className="font-bold text-slate-900">No leads found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {search ? "Try a different search term." : "Submissions from the landing page will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="text-sm" style={{ minWidth: "1200px", width: "100%" }}>
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold" style={{ width: "160px" }}>Student</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "145px" }}>Contact</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "80px" }}>City</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "75px" }}>Board</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "120px" }}>Medium</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "140px" }}>Submitted</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "150px" }}>Status</th>
                  <th className="px-4 py-3 font-semibold text-center" style={{ width: "100px" }}>Enrolled</th>
                  <th className="px-4 py-3 font-semibold" style={{ minWidth: "180px" }}>Note</th>
                  <th className="px-4 py-3 font-semibold" style={{ width: "48px" }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors align-top">

                    {/* Student */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f97015] to-[#d95e05] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {l.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-xs truncate">{l.name}</div>
                          {l.utm_source && (
                            <div className="text-[10px] text-[#f97015] truncate">via {l.utm_source}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <a
                          href={`tel:+91${l.phone.replace(/\D/g, "")}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                        <a
                          href={`https://wa.me/91${l.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WA
                        </a>
                      </div>
                      <div className="text-[11px] text-slate-400">+91 {l.phone.replace(/\D/g, "")}</div>
                    </td>

                    {/* City */}
                    <td className="px-4 py-3 text-xs text-slate-600">{l.city || "—"}</td>

                    {/* Board */}
                    <td className="px-4 py-3 text-xs text-slate-600">{l.board || "—"}</td>

                    {/* Medium */}
                    <td className="px-4 py-3 text-xs text-slate-600">{l.medium || "—"}</td>

                    {/* Submitted */}
                    <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <select
                        value={l.status}
                        onChange={(e) => onStatusChange(l.id, e.target.value)}
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg bg-white text-xs font-medium focus:border-[#f97015] focus:ring-2 focus:ring-orange-100 focus:outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Enrolled toggle */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => onEnrolledToggle(l.id, !l.enrolled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            l.enrolled
                              ? "bg-emerald-500 focus:ring-emerald-400"
                              : "bg-[#f97015] focus:ring-orange-400"
                          }`}
                          aria-label="Toggle enrolled"
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            l.enrolled ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                        <span className={`text-[10px] font-bold ${l.enrolled ? "text-emerald-600" : "text-[#f97015]"}`}>
                          {l.enrolled ? "Enrolled" : "Not yet"}
                        </span>
                      </div>
                    </td>

                    {/* Note */}
                    <td className="px-4 py-3">
                      <NoteCell lead={l} onSave={onNoteChange} />
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onDelete(l.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex items-center justify-center"
                        aria-label="Delete lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadManagerDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLeadsRoute = location.pathname.includes("/leads");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>({ from: "", to: "" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) toast.error("Failed to load leads");
      else setLeads((data ?? []) as Lead[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("lead-manager-leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        setLeads((prev) => [payload.new as Lead, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (payload) => {
        setLeads((prev) => prev.map((l) => l.id === payload.new.id ? { ...l, ...(payload.new as Lead) } : l));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  // Filter: search, status filter, date range
  const filtered = useMemo(() => {
    let result = leads;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.phone, l.city, l.board, l.medium, l.status,
         l.utm_source, l.utm_medium, l.utm_campaign]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (statusFilter) {
      if (statusFilter === "enrolled") {
        result = result.filter((l) => l.enrolled === true);
      } else {
        result = result.filter((l) => l.status === statusFilter);
      }
    }

    if (dateFilter.from) {
      const from = new Date(dateFilter.from);
      from.setHours(0, 0, 0, 0);
      result = result.filter((l) => new Date(l.created_at) >= from);
    }
    if (dateFilter.to) {
      const to = new Date(dateFilter.to);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.created_at) <= to);
    }

    return result;
  }, [leads, search, statusFilter, dateFilter]);

  const updateStatus = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error("Failed to update status");
  };

  const toggleEnrolled = async (id: string, enrolled: boolean) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, enrolled } : l));
    const { error } = await supabase.from("leads").update({ enrolled }).eq("id", id);
    if (error) toast.error("Failed to update enrollment");
    else toast.success(enrolled ? "Marked as enrolled" : "Enrollment removed");
  };

  const saveNote = async (id: string, notes: string) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
    const { error } = await supabase.from("leads").update({ notes }).eq("id", id);
    if (error) toast.error("Failed to save note");
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error("Failed to delete lead");
  };

  if (isLeadsRoute) {
    return (
      <LeadsTab
        leads={filtered}
        total={leads.length}
        loading={loading}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        onStatusChange={updateStatus}
        onEnrolledToggle={toggleEnrolled}
        onNoteChange={saveNote}
        onDelete={deleteLead}
      />
    );
  }

  return <OverviewTab leads={leads} onGoLeads={() => navigate("/lead-manager/leads")} />;
}
