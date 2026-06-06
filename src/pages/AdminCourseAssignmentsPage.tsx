import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookmarkPlus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  student_id: z.string().min(1, "Select a student"),
  course_id: z.string().min(1, "Select a course"),
  amount: z.coerce.number().min(0, "Amount must be 0 or more"),
  gateway: z.enum(["cash", "bank-transfer", "razorpay", "cheque", "other"], {
    required_error: "Select a payment method",
  }),
  external_id: z.string().optional(),
  expires_at: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type StudentRow = { user_id: string; full_name: string | null; phone: string | null };
type CourseRow = { id: string; name: string; subject: string };
type AssignmentRow = {
  id: string;
  created_at: string;
  amount: number;
  gateway: string;
  external_id: string | null;
  student_name: string | null;
  course_name: string;
  expires_at: string | null;
};

const GATEWAYS = [
  { value: "cash", label: "Cash" },
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "razorpay", label: "Razorpay" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const AdminCourseAssignmentsPage = () => {
  const qc = useQueryClient();
  const [studentSearch, setStudentSearch] = useState("");

  const { data: students = [] } = useQuery<StudentRow[]>({
    queryKey: ["admin-students-list"],
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (roleErr) throw roleErr;

      const studentIds = (roleRows ?? []).map((r) => r.user_id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", studentIds)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: courses = [] } = useQuery<CourseRow[]>({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, subject")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<AssignmentRow[]>({
    queryKey: ["admin-course-assignments-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, created_at, amount, gateway, external_id, student_name, user_id")
        .in("gateway", ["cash", "bank-transfer", "cheque", "other"])
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Attach course name + expires_at via enrollments (best-effort)
      const rows = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: enr } = await supabase
            .from("enrollments")
            .select("course_id, expires_at, courses(name)")
            .eq("user_id", p.user_id ?? "")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const courseName = (enr?.courses as any)?.name ?? "—";
          return { ...p, course_name: courseName, expires_at: enr?.expires_at ?? null };
        })
      );
      return rows;
    },
    staleTime: 60 * 1000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, external_id: "", expires_at: "" },
  });

  const assign = useMutation({
    mutationFn: async (values: FormValues) => {
      const student = students.find((s) => s.user_id === values.student_id);
      const course = courses.find((c) => c.id === values.course_id);
      if (!student || !course) throw new Error("Invalid student or course");

      // 1. Record payment
      const { error: payErr } = await supabase.from("payments").insert({
        user_id: student.user_id,
        student_name: student.full_name,
        amount: values.amount,
        currency: "INR",
        gateway: values.gateway,
        external_id: values.external_id || null,
        status: "success",
      });
      if (payErr) throw payErr;

      // 2. Upsert enrollment with optional expiry
      // expires_at not yet in generated types (migration pending) — cast via unknown.
      const expiresAt = values.expires_at ? new Date(values.expires_at).toISOString() : null;
      const { error: enrErr } = await supabase.from("enrollments").upsert(
        { user_id: student.user_id, course_id: course.id, is_active: true, expires_at: expiresAt },
        { onConflict: "user_id,course_id" }
      );
      if (enrErr) throw enrErr;

      return { studentName: student.full_name, courseName: course.name };
    },
    onSuccess: ({ studentName, courseName }) => {
      toast.success(`Assigned ${courseName} to ${studentName ?? "student"}`);
      form.reset({ amount: 0, external_id: "", expires_at: "", student_id: "", course_id: "", gateway: undefined });
      qc.invalidateQueries({ queryKey: ["admin-course-assignments-history"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    },
  });

  const filteredStudents = studentSearch.trim()
    ? students.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.phone?.includes(studentSearch)
      )
    : students;

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-display font-black text-navy flex items-center gap-2">
          <BookmarkPlus className="h-6 w-6 text-primary" /> Course Assignments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manually enroll a student in a course and record the offline payment.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-base font-semibold mb-4">New Assignment</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => assign.mutate(v))} className="space-y-5">
            {/* Student + Course in one row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student picker */}
              <div className="space-y-1.5">
                <Label>Student</Label>
                <div className="relative mb-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {filteredStudents.map((s) => (
                            <SelectItem key={s.user_id} value={s.user_id}>
                              {s.full_name || "Unnamed"}{s.phone ? ` · ${s.phone}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Course picker */}
              <FormField
                control={form.control}
                name="course_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (INR)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gateway */}
              <FormField
                control={form.control}
                name="gateway"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GATEWAYS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference ID */}
              <FormField
                control={form.control}
                name="external_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference / Receipt No. <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CASH-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validity date */}
              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until <span className="text-muted-foreground">(optional — leave blank for no expiry)</span></FormLabel>
                    <FormControl>
                      <Input type="date" min={new Date().toISOString().split("T")[0]} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={assign.isPending} className="gap-2">
              {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign Course
            </Button>
          </form>
        </Form>
      </div>

      {/* History */}
      <div>
        <h2 className="text-base font-semibold mb-3">Recent Manual Assignments</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Valid Until</th>
                  <th className="px-4 py-3 font-semibold">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No manual assignments yet.
                  </td></tr>
                ) : history.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.student_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.course_name}</td>
                    <td className="px-4 py-3">₹{r.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize">{r.gateway}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.external_id || "—"}</td>
                    <td className="px-4 py-3">
                      {r.expires_at ? (
                        <span className={new Date(r.expires_at) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {new Date(r.expires_at).toLocaleDateString("en-IN")}
                          {new Date(r.expires_at) < new Date() && " (expired)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCourseAssignmentsPage;
