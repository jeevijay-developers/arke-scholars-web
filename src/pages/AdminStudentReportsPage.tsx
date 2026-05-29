import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Download, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  downloadStudentReport,
  fetchStudentReport,
  daysRange,
} from "@/lib/studentReport";

type StudentRow = {
  user_id: string;
  full_name: string | null;
  target_exam: string | null;
  class_level: string | null;
};

const RANGE_OPTIONS = [
  { value: "15",  label: "Last 15 Days" },
  { value: "30",  label: "Last 30 Days" },
  { value: "60",  label: "Last 60 Days" },
  { value: "90",  label: "Last 90 Days" },
  { value: "365", label: "Last 1 Year" },
];

const AdminStudentReportsPage = () => {
  const [timeRange, setTimeRange] = useState<string>("30");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: roleRows, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "student");
        if (rErr) throw rErr;
        const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
        if (!ids.length) { setStudents([]); return; }
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name, target_exam, class_level")
          .in("user_id", ids)
          .order("full_name", { ascending: true });
        if (error) throw error;
        setStudents((data ?? []) as StudentRow[]);
      } catch (e: any) {
        toast.error("Failed to load students", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const range = useMemo(() => daysRange(Number(timeRange)), [timeRange]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return students;
    return students.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(s) ||
      (r.target_exam ?? "").toLowerCase().includes(s),
    );
  }, [students, search]);

  async function generate(studentId: string) {
    if (!studentId) {
      toast.error("Pick a student first");
      return;
    }
    setGeneratingId(studentId);
    try {
      const data = await fetchStudentReport(studentId, range);
      downloadStudentReport(data);
      toast.success("Report downloaded", { description: `${data.student.name} • ${data.period}` });
    } catch (e: any) {
      toast.error("Failed to generate report", { description: e?.message });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <FileBarChart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Report</h1>
          <p className="text-sm text-muted-foreground">
            Generate a parent-friendly monthly academic PDF for any student.
          </p>
        </div>
      </div>

      {/* Quick generator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick generate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <div>
            <Label className="mb-1 block">Student</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading…" : "Select a student"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {students.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.full_name || "Unnamed"}
                    {s.target_exam ? ` · ${s.target_exam}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Time Range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => generate(selectedId)}
            disabled={!selectedId || generatingId === selectedId}
            className="w-full md:w-auto"
          >
            {generatingId === selectedId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </CardContent>
      </Card>

      {/* All students */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">All students</CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or exam"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Target exam</TableHead>
                  <TableHead className="text-right">Action ({range.label})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium">{s.full_name || "Unnamed"}</TableCell>
                      <TableCell>{s.class_level || "—"}</TableCell>
                      <TableCell>{s.target_exam || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generate(s.user_id)}
                          disabled={generatingId === s.user_id}
                        >
                          {generatingId === s.user_id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStudentReportsPage;
