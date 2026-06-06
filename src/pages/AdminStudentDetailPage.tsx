/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CreditCard, Loader2, Save, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useExams } from "@/hooks/useExams";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CityStateFields from "@/components/CityStateFields";
import { CLASS_LEVELS } from "@/lib/constants";

type ProfileData = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  state?: string | null;
  target_exam: string | null;
  class_level: string | null;
  is_suspended: boolean;
  onboarding_completed: boolean;
  doubt_preference: string;
  created_at: string;
  email?: string | null;
};

type EnrollmentRow = {
  id: string;
  created_at: string;
  is_active: boolean;
  expires_at: string | null;
  courses: { name: string; subject: string } | null;
};

type PaymentRow = {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  external_id: string | null;
  status: string;
};

type CourseLite = { id: string; name: string; subject: string };

const initials = (name: string | null) =>
  (name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const AdminStudentDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { examNames } = useExams();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<ProfileData>>({});
  const [saving, setSaving] = useState(false);

  const [suspending, setSuspending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Courses tab
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [enrollFormOpen, setEnrollFormOpen] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollExpiry, setEnrollExpiry] = useState("");
  const [enrollSaving, setEnrollSaving] = useState(false);

  // Payments tab
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  // ── Load profile ────────────────────────────────────────────────────────────
  const loadProfile = async () => {
    if (!userId) return;
    setProfileLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name, phone, avatar_url, country, city, target_exam, class_level, is_suspended, onboarding_completed, doubt_preference, created_at")
        .eq("user_id", userId)
        .single();
      if (error) throw error;

      const { data: emailData } = await supabase.functions.invoke("manage-student", {
        body: { action: "get_emails", user_ids: [userId] },
      });
      const email = emailData?.emails?.[userId] ?? null;

      const p: ProfileData = { ...data, email };
      setProfile(p);
      setEdit({
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        target_exam: p.target_exam ?? "",
        class_level: p.class_level ?? "",
        city: p.city ?? "",
        state: "",
        country: p.country ?? "",
      });
    } catch (e: any) {
      toast.error("Failed to load student", { description: e.message });
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Load enrollments ─────────────────────────────────────────────────────────
  const loadEnrollments = async () => {
    if (!userId) return;
    setEnrollmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, created_at, is_active, expires_at, courses(name, subject)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEnrollments((data ?? []) as EnrollmentRow[]);
    } catch (e: any) {
      toast.error("Failed to load enrollments", { description: e.message });
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  // ── Load payments ────────────────────────────────────────────────────────────
  const loadPayments = async () => {
    if (!userId) return;
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id, created_at, amount, currency, external_id, status")
        .eq("user_id", userId)
        .eq("gateway", "razorpay")
        .eq("status", "success")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPayments((data ?? []) as PaymentRow[]);
    } catch (e: any) {
      toast.error("Failed to load payments", { description: e.message });
    } finally {
      setPaymentsLoading(false);
    }
  };

  // ── Load courses list for enroll form ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("courses").select("id, name, subject").order("name");
      setCourses((data as CourseLite[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    loadProfile();
    loadEnrollments();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: { action: "update", user_id: userId, ...edit },
      });
      if (error) throw error;
      toast.success("Student updated");
      loadProfile();
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Suspend / unsuspend ───────────────────────────────────────────────────────
  const toggleSuspend = async () => {
    if (!profile) return;
    setSuspending(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: { action: "set_suspended", user_id: userId, is_suspended: !profile.is_suspended },
      });
      if (error) throw error;
      toast.success(profile.is_suspended ? "Student unsuspended" : "Student suspended");
      loadProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSuspending(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const doDelete = async () => {
    if (!userId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      toast.success("Student deleted");
      navigate("/admin/students");
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
      setDeleting(false);
    }
  };

  // ── Enroll in course ─────────────────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!enrollCourseId) return toast.error("Select a course");
    setEnrollSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-student", {
        body: {
          action: "enroll",
          user_id: userId,
          course_id: enrollCourseId,
          expires_at: enrollExpiry || null,
        },
      });
      if (error) throw error;
      toast.success("Course enrolled");
      setEnrollFormOpen(false);
      setEnrollCourseId("");
      setEnrollExpiry("");
      loadEnrollments();
    } catch (e: any) {
      toast.error("Enrollment failed", { description: e.message });
    } finally {
      setEnrollSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const isExpired = (exp: string | null) => exp ? new Date(exp) < new Date() : false;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN");
  const avatarText = initials(profile?.full_name ?? null);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Student not found.{" "}
        <button onClick={() => navigate("/admin/students")} className="text-primary underline">
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      {/* Back */}
      <button
        onClick={() => navigate("/admin/students")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Students
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-xl font-bold text-primary overflow-hidden">
          {profile.avatar_url?.trim() ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.parentElement as HTMLElement).innerText = avatarText;
              }}
            />
          ) : (
            avatarText
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-bold text-foreground truncate">{profile.full_name || "Unnamed"}</h1>
            {profile.is_suspended ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase">Suspended</span>
            ) : (
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">Active</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{profile.email || "No email"}</p>
          <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span>Joined {fmtDate(profile.created_at)}</span>
            {profile.phone && <span>· {profile.phone}</span>}
            {profile.target_exam && <span>· {profile.target_exam}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="information">
        <div className="overflow-x-auto">
          <TabsList className="flex w-full min-w-max">
            <TabsTrigger value="information" className="flex items-center gap-1.5 flex-1 min-w-[120px]">
              <User className="h-3.5 w-3.5" /> Information
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center gap-1.5 flex-1 min-w-[120px]">
              <BookOpen className="h-3.5 w-3.5" /> Courses
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <CreditCard className="h-3.5 w-3.5" /> Payment History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Information ───────────────────────────────────────────────────── */}
        <TabsContent value="information" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Profile Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: "full_name", label: "Full Name", placeholder: "Full name" },
                { key: "phone", label: "Phone", placeholder: "Phone number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    value={(edit as any)[f.key] ?? ""}
                    onChange={(e) => setEdit((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Class Level</label>
                <select
                  value={edit.class_level ?? ""}
                  onChange={(e) => setEdit((s) => ({ ...s, class_level: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                >
                  <option value="">— Select class —</option>
                  {CLASS_LEVELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CityStateFields
                  city={edit.city ?? ""}
                  state={edit.state ?? ""}
                  country={edit.country ?? ""}
                  onCityChange={(v) => setEdit((s) => ({ ...s, city: v }))}
                  onStateChange={(v) => setEdit((s) => ({ ...s, state: v }))}
                  onCountryChange={(v) => setEdit((s) => ({ ...s, country: v }))}
                  inputClassName="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                  labelClassName="text-[10px] font-bold text-muted-foreground uppercase tracking-wide"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Target Exam</label>
                <select
                  value={edit.target_exam ?? ""}
                  onChange={(e) => setEdit((s) => ({ ...s, target_exam: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                >
                  <option value="">— Select exam —</option>
                  {examNames.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Read-only stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 rounded-lg border border-border bg-background/50 p-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Onboarding</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{profile.onboarding_completed ? "Completed" : "Pending"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Doubt Routing</p>
                <p className="text-xs font-medium text-foreground mt-0.5 capitalize">{profile.doubt_preference || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                <p className={`text-xs font-medium mt-0.5 ${profile.is_suspended ? "text-destructive" : "text-secondary"}`}>
                  {profile.is_suspended ? "Suspended" : "Active"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60 cursor-pointer transition-colors hover:bg-primary/90"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h2>
            <p className="text-xs text-muted-foreground mb-4">These actions cannot be undone.</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={toggleSuspend}
                disabled={suspending}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-xs font-medium disabled:opacity-60 cursor-pointer transition-colors ${
                  profile.is_suspended
                    ? "border-secondary/40 text-secondary hover:bg-secondary/5"
                    : "border-destructive/40 text-destructive hover:bg-destructive/10"
                }`}
              >
                {suspending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {profile.is_suspended ? "Unsuspend Student" : "Suspend Student"}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/20 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Student
              </button>
            </div>
          </div>
        </TabsContent>

        {/* ── Courses ───────────────────────────────────────────────────────── */}
        <TabsContent value="courses" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-sm font-semibold text-foreground">Enrolled Courses</h2>
              <button
                onClick={() => setEnrollFormOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground cursor-pointer transition-colors hover:bg-primary/90"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {enrollFormOpen ? "Cancel" : "Enroll in Course"}
              </button>
            </div>

            {/* Inline enroll form */}
            {enrollFormOpen && (
              <div className="mb-4 rounded-lg border border-border bg-background/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">New Enrollment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Course <span className="text-destructive">*</span></label>
                    <select
                      value={enrollCourseId}
                      onChange={(e) => setEnrollCourseId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    >
                      <option value="">— Select a course —</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Valid Until <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={enrollExpiry}
                      onChange={(e) => setEnrollExpiry(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleEnroll}
                    disabled={enrollSaving || !enrollCourseId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60 cursor-pointer transition-colors hover:bg-primary/90"
                  >
                    {enrollSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                    Assign Course
                  </button>
                  <button
                    onClick={() => { setEnrollFormOpen(false); setEnrollCourseId(""); setEnrollExpiry(""); }}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-background"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Enrollments table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left">
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Course</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Subject</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Enrolled</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Valid Until</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentsLoading ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />
                    </td></tr>
                  ) : enrollments.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No enrollments yet.
                    </td></tr>
                  ) : enrollments.map((enr) => (
                    <tr key={enr.id} className="border-t border-border">
                      <td className="px-3 py-2.5 font-medium text-foreground">{enr.courses?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{enr.courses?.subject ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{fmtDate(enr.created_at)}</td>
                      <td className="px-3 py-2.5">
                        {enr.expires_at ? (
                          <span className={isExpired(enr.expires_at) ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {fmtDate(enr.expires_at)}{isExpired(enr.expires_at) ? " (expired)" : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No expiry</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {enr.is_active && !isExpired(enr.expires_at) ? (
                          <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">Active</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Payment History ───────────────────────────────────────────────── */}
        <TabsContent value="payments" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Online Payment History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left">
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Amount</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Currency</th>
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsLoading ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />
                    </td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No online payments yet.
                    </td></tr>
                  ) : payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{p.currency}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.external_id || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setConfirmDelete(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Delete student permanently?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This will permanently delete{" "}
                  <span className="font-semibold text-foreground">{profile.full_name || "this student"}</span>{" "}
                  and all their data including enrollments and progress. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={doDelete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60 cursor-pointer hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentDetailPage;
