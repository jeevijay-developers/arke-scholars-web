import { useEffect, useMemo, useRef, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  Loader2,
  Plus,
  Search,
  UserMinus,
  UserPlus,
  Users,
  CheckSquare,
  Square,
  Upload,
  Download,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";

type Profile = { user_id: string; full_name: string | null; email?: string | null };
type Mentor = Profile & { studentCount: number };
type Assignment = { id: string; mentor_id: string; student_id: string; assigned_at: string };

type CsvRow = {
  rowNum: number;
  mentorKey: string;
  studentKey: string;
  mentorId?: string;
  studentId?: string;
  status: "ok" | "duplicate" | "missing-mentor" | "missing-student";
  message?: string;
};

const PAGE_SIZE = 25;

const AdminMentorAssignmentsPage = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMentor, setSelectedMentor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mentorSearch, setMentorSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Pagination on assigned-students list
  const [studentPage, setStudentPage] = useState(1);

  // CSV import
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [mentorRoles, studentRoles, asg] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "mentor"),
      supabase.from("user_roles").select("user_id").eq("role", "student"),
      supabase
        .from("mentor_student_assignments")
        .select("id, mentor_id, student_id, assigned_at")
        .is("removed_at", null),
    ]);

    const mentorIds = (mentorRoles.data ?? []).map((r) => r.user_id);
    const studentIds = (studentRoles.data ?? []).map((r) => r.user_id);
    const allIds = Array.from(new Set([...mentorIds, ...studentIds]));

    const { data: profiles } = allIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", allIds)
      : { data: [] as Profile[] };

    const profilesMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const asgList = (asg.data ?? []) as Assignment[];

    const mentorList: Mentor[] = mentorIds.map((id) => ({
      user_id: id,
      full_name: profilesMap.get(id)?.full_name ?? null,
      studentCount: asgList.filter((a) => a.mentor_id === id).length,
    }));

    setMentors(mentorList.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")));
    setStudents(
      studentIds
        .map((id) => ({ user_id: id, full_name: profilesMap.get(id)?.full_name ?? null }))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    );
    setAssignments(asgList);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedMentor && mentors[0]) setSelectedMentor(mentors[0].user_id);
  }, [mentors, selectedMentor]);

  useEffect(() => {
    setStudentPage(1);
  }, [selectedMentor]);

  const studentsById = useMemo(() => new Map(students.map((s) => [s.user_id, s])), [students]);
  const mentorAssignments = useMemo(
    () => assignments.filter((a) => a.mentor_id === selectedMentor),
    [assignments, selectedMentor],
  );
  const assignedStudentIds = useMemo(
    () => new Set(mentorAssignments.map((a) => a.student_id)),
    [mentorAssignments],
  );
  const availableStudents = useMemo(
    () =>
      students
        .filter((s) => !assignedStudentIds.has(s.user_id))
        .filter((s) => (s.full_name ?? "").toLowerCase().includes(search.toLowerCase())),
    [students, assignedStudentIds, search],
  );

  const filteredMentors = useMemo(() => {
    const q = mentorSearch.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter((m) => (m.full_name ?? "").toLowerCase().includes(q));
  }, [mentors, mentorSearch]);

  const totalStudentPages = Math.max(1, Math.ceil(mentorAssignments.length / PAGE_SIZE));
  const pagedAssignments = useMemo(
    () => mentorAssignments.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE),
    [mentorAssignments, studentPage],
  );

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (bulkSelected.size === availableStudents.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(availableStudents.map((s) => s.user_id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedMentor || bulkSelected.size === 0) return;
    setBulkAssigning(true);
    const { data: userRes } = await supabase.auth.getUser();
    const adminId = userRes.user?.id;
    if (!adminId) {
      toast.error("Not authenticated");
      setBulkAssigning(false);
      return;
    }
    const rows = Array.from(bulkSelected).map((studentId) => ({
      mentor_id: selectedMentor,
      student_id: studentId,
      assigned_by: adminId,
      assigned_at: new Date().toISOString(),
      removed_at: null,
    }));
    const { error } = await supabase
      .from("mentor_student_assignments")
      .upsert(rows, { onConflict: "mentor_id,student_id" });
    setBulkAssigning(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Assigned ${rows.length} student${rows.length === 1 ? "" : "s"}`);
    setBulkSelected(new Set());
    setShowAdd(false);
    load();
  };

  const handleRemove = async (assignmentId: string, studentName?: string) => {
    const ok = await confirm({
      title: studentName ? `Remove ${studentName} from this mentor?` : "Remove this student from the mentor?",
      description: "The student will no longer have this mentor assigned. You can reassign them later. Past chat history is preserved.",
      confirmLabel: "Remove student",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("mentor_student_assignments")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Student removed");
    load();
  };

  // ---------- CSV Import ----------
  const downloadTemplate = () => {
    const csv =
      "mentor,student\nVikram Thapar,Aarav Sharma\nAnanya Iyer,Priya Patel\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mentor-assignments-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): { rows: CsvRow[] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { rows: [] };

    // Detect header
    const first = lines[0].toLowerCase();
    const hasHeader = first.includes("mentor") && first.includes("student");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const mentorByName = new Map<string, string>();
    mentors.forEach((m) => {
      if (m.full_name) mentorByName.set(m.full_name.trim().toLowerCase(), m.user_id);
    });
    const studentByName = new Map<string, string>();
    students.forEach((s) => {
      if (s.full_name) studentByName.set(s.full_name.trim().toLowerCase(), s.user_id);
    });
    const mentorByUuid = new Set(mentors.map((m) => m.user_id));
    const studentByUuid = new Set(students.map((s) => s.user_id));

    const seen = new Set<string>();
    const existing = new Set(assignments.map((a) => `${a.mentor_id}::${a.student_id}`));

    const rows: CsvRow[] = dataLines.map((line, idx) => {
      // simple CSV split (no quoted-comma support for v1)
      const parts = line.split(",").map((p) => p.trim());
      const mentorKey = parts[0] ?? "";
      const studentKey = parts[1] ?? "";

      const mentorId =
        mentorByUuid.has(mentorKey) ? mentorKey : mentorByName.get(mentorKey.toLowerCase());
      const studentId =
        studentByUuid.has(studentKey) ? studentKey : studentByName.get(studentKey.toLowerCase());

      let status: CsvRow["status"] = "ok";
      let message: string | undefined;
      if (!mentorId) {
        status = "missing-mentor";
        message = `Mentor "${mentorKey}" not found`;
      } else if (!studentId) {
        status = "missing-student";
        message = `Student "${studentKey}" not found`;
      } else {
        const key = `${mentorId}::${studentId}`;
        if (existing.has(key) || seen.has(key)) {
          status = "duplicate";
          message = "Already assigned";
        }
        seen.add(key);
      }

      return {
        rowNum: idx + (hasHeader ? 2 : 1),
        mentorKey,
        studentKey,
        mentorId,
        studentId,
        status,
        message,
      };
    });

    return { rows };
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2MB)");
      return;
    }
    const text = await file.text();
    const { rows } = parseCsv(text);
    if (rows.length === 0) {
      toast.error("CSV is empty");
      return;
    }
    setCsvRows(rows);
  };

  const importValidRows = async () => {
    const valid = csvRows.filter((r) => r.status === "ok" && r.mentorId && r.studentId);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const adminId = userRes.user?.id;
    if (!adminId) {
      toast.error("Not authenticated");
      setImporting(false);
      return;
    }
    const payload = valid.map((r) => ({
      mentor_id: r.mentorId!,
      student_id: r.studentId!,
      assigned_by: adminId,
      assigned_at: new Date().toISOString(),
      removed_at: null,
    }));
    const { error } = await supabase
      .from("mentor_student_assignments")
      .upsert(payload, { onConflict: "mentor_id,student_id" });
    setImporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Imported ${payload.length} assignment${payload.length === 1 ? "" : "s"}`);
    setCsvRows([]);
    setShowImport(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const closeImport = () => {
    setShowImport(false);
    setCsvRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const selected = mentors.find((m) => m.user_id === selectedMentor);

  // Virtualized rows
  const MENTOR_ROW = 64;
  const ASSIGNED_ROW = 60;
  const AVAILABLE_ROW = 40;

  const MentorRow = ({ index, style }: RowComponentProps) => {
    const m = filteredMentors[index];
    if (!m) return null;
    const active = m.user_id === selectedMentor;
    return (
      <button
        key={m.user_id}
        style={style}
        onClick={() => setSelectedMentor(m.user_id)}
        className={`flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 text-left transition-colors ${
          active ? "bg-secondary/15" : "hover:bg-muted/40"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{m.full_name || "Unnamed mentor"}</p>
          <p className="text-[10px] text-muted-foreground">{m.studentCount} students</p>
        </div>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {m.studentCount}
        </span>
      </button>
    );
  };

  const AssignedRow = ({ index, style }: RowComponentProps) => {
    const a = pagedAssignments[index];
    if (!a) return null;
    const stu = studentsById.get(a.student_id);
    return (
      <div style={style} className="flex items-center justify-between gap-3 px-4 border-b border-border">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{stu?.full_name || "Student"}</p>
          <p className="text-[11px] text-muted-foreground">
            Assigned {new Date(a.assigned_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => handleRemove(a.id, stu?.full_name || undefined)}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          <UserMinus className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    );
  };

  const AvailableRow = ({ index, style }: RowComponentProps) => {
    const s = availableStudents[index];
    if (!s) return null;
    const checked = bulkSelected.has(s.user_id);
    return (
      <button
        key={s.user_id}
        style={style}
        onClick={() => toggleBulk(s.user_id)}
        className="flex w-full items-center gap-2 px-1 text-left hover:bg-muted/40 rounded border-b border-border/40"
      >
        {checked ? (
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <p className="truncate text-sm text-foreground flex-1">{s.full_name || "Student"}</p>
      </button>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-secondary via-primary to-accent p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black font-display">Mentor Assignments</h1>
            <p className="text-white/90 text-sm mt-1">Assign students to mentors for 1:1 and group support.</p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-white/90"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
        </div>
        <div className="flex gap-4 mt-4 flex-wrap">
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{mentors.length}</p>
            <p className="text-[10px] text-white/80">Mentors</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">{assignments.length}</p>
            <p className="text-[10px] text-white/80">Active assignments</p>
          </div>
          <div className="rounded-xl bg-white/20 px-4 py-2 text-center">
            <p className="text-lg font-bold">
              {students.filter((s) => !assignments.some((a) => a.student_id === s.user_id)).length}
            </p>
            <p className="text-[10px] text-white/80">Unassigned students</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : mentors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">No mentors yet</p>
          <p className="text-xs text-muted-foreground">Create a mentor account from the Users page first.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Mentors list (virtualized) */}
          <aside className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mentors</p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={mentorSearch}
                  onChange={(e) => setMentorSearch(e.target.value)}
                  placeholder="Search mentors…"
                  className="flex-1 bg-transparent text-xs outline-none"
                />
              </div>
            </div>
            {filteredMentors.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No mentors match.</p>
            ) : (
              <List
                rowComponent={MentorRow}
                rowCount={filteredMentors.length}
                rowHeight={MENTOR_ROW}
                rowProps={{}}
                style={{ height: Math.min(filteredMentors.length, 9) * MENTOR_ROW }}
              />
            )}
          </aside>

          {/* Selected mentor's students (virtualized + paginated) */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="text-sm font-bold text-foreground">{selected?.full_name || "Mentor"}</p>
                <p className="text-xs text-muted-foreground">{mentorAssignments.length} assigned students</p>
              </div>
              <button
                onClick={() => {
                  setBulkSelected(new Set());
                  setSearch("");
                  setShowAdd(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" /> Assign students
              </button>
            </div>
            {mentorAssignments.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No students assigned to this mentor yet.</p>
            ) : (
              <>
                <List
                  rowComponent={AssignedRow}
                  rowCount={pagedAssignments.length}
                  rowHeight={ASSIGNED_ROW}
                  rowProps={{}}
                  style={{ height: Math.min(pagedAssignments.length, 10) * ASSIGNED_ROW }}
                />
                <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-border">
                  <span>
                    {(studentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(studentPage * PAGE_SIZE, mentorAssignments.length)} of{" "}
                    {mentorAssignments.length}
                  </span>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                      disabled={studentPage === 1}
                      className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span>
                      {studentPage} / {totalStudentPages}
                    </span>
                    <button
                      onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                      disabled={studentPage === totalStudentPages}
                      className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Bulk add-students dialog (virtualized) */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4" onClick={() => setShowAdd(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-foreground">Assign students to {selected?.full_name}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            {availableStudents.length > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {bulkSelected.size === availableStudents.length ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {bulkSelected.size === availableStudents.length ? "Unselect all" : "Select all"}
                </button>
                <span className="text-[11px] text-muted-foreground">{bulkSelected.size} selected</span>
              </div>
            )}

            <div className="mt-2">
              {availableStudents.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No matching students.</p>
              ) : (
                <List
                  rowComponent={AvailableRow}
                  rowCount={availableStudents.length}
                  rowHeight={AVAILABLE_ROW}
                  rowProps={{}}
                  style={{ height: Math.min(availableStudents.length, 10) * AVAILABLE_ROW }}
                />
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={bulkSelected.size === 0 || bulkAssigning}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {bulkAssigning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Assign {bulkSelected.size > 0 ? `(${bulkSelected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import dialog */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={closeImport}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Bulk import mentor assignments</p>
              <button onClick={closeImport} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV with two columns: <code className="text-foreground">mentor</code> and{" "}
              <code className="text-foreground">student</code>. Match by full name (case-insensitive) or user UUID.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> Download template
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Choose CSV file
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>

            {csvRows.length > 0 && (
              <>
                {(() => {
                  const ok = csvRows.filter((r) => r.status === "ok").length;
                  const dup = csvRows.filter((r) => r.status === "duplicate").length;
                  const bad = csvRows.length - ok - dup;
                  return (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-border bg-muted/30 p-2">
                        <p className="text-lg font-bold text-primary">{ok}</p>
                        <p className="text-[10px] text-muted-foreground">Ready</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-2">
                        <p className="text-lg font-bold text-foreground">{dup}</p>
                        <p className="text-[10px] text-muted-foreground">Duplicates</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-2">
                        <p className="text-lg font-bold text-destructive">{bad}</p>
                        <p className="text-[10px] text-muted-foreground">Errors</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1.5">#</th>
                        <th className="px-2 py-1.5">Mentor</th>
                        <th className="px-2 py-1.5">Student</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r) => (
                        <tr key={r.rowNum} className="border-t border-border">
                          <td className="px-2 py-1 text-muted-foreground">{r.rowNum}</td>
                          <td className="px-2 py-1 truncate max-w-[160px]">{r.mentorKey}</td>
                          <td className="px-2 py-1 truncate max-w-[160px]">{r.studentKey}</td>
                          <td className="px-2 py-1">
                            {r.status === "ok" ? (
                              <span className="text-primary font-semibold">Ready</span>
                            ) : r.status === "duplicate" ? (
                              <span className="text-muted-foreground">Already assigned</span>
                            ) : (
                              <span className="text-destructive">{r.message}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={closeImport}
                    disabled={importing}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importValidRows}
                    disabled={importing || csvRows.filter((r) => r.status === "ok").length === 0}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Import {csvRows.filter((r) => r.status === "ok").length} rows
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};

export default AdminMentorAssignmentsPage;
