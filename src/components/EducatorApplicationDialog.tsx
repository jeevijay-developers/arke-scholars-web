import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Upload, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";

const MAX_PHOTO = 2 * 1024 * 1024; // 2MB
const MAX_RESUME = 5 * 1024 * 1024; // 5MB

const schema = z.object({
  candidate_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  date_of_birth: z.date({ required_error: "Date of birth is required" }),
  contact_no: z.string().trim().min(7, "Enter a valid contact number").max(20),
  alt_contact_no: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().min(1, "Select a subject"),
  class_level: z.array(z.string()).min(1, "Select at least one class level"),
  highest_qualification: z.string().trim().min(2, "Required").max(100),
  other_qualification: z.string().trim().max(200).optional().or(z.literal("")),
  current_organization: z.string().trim().max(150).optional().or(z.literal("")),
  previous_organization: z.string().trim().max(150).optional().or(z.literal("")),
  total_experience: z.coerce.number().min(0, "Must be 0 or more").max(60),
  current_ctc: z.coerce.number().min(0).optional().or(z.nan().transform(() => undefined)),
  expected_ctc: z.coerce.number().min(0, "Required").max(10000000),
  demo_video_link: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(500)
    .refine(
      (url) => /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)[\w-]{11}|youtu\.be\/[\w-]{11})([&?#].*)?$/i.test(url),
      "Only YouTube video links are allowed (e.g. https://youtube.com/watch?v=... or https://youtu.be/...)"
    ),
  photo: z
    .instanceof(FileList)
    .refine((f) => f.length > 0, "Photo is required")
    .refine((f) => f[0]?.size <= MAX_PHOTO, "Photo must be ≤ 2MB")
    .refine((f) => f[0]?.type.startsWith("image/"), "Must be an image"),
  resume: z
    .instanceof(FileList)
    .refine((f) => f.length > 0, "Resume is required")
    .refine((f) => f[0]?.size <= MAX_RESUME, "Resume must be ≤ 5MB")
    .refine(
      (f) => ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(f[0]?.type),
      "Must be PDF or DOC/DOCX"
    ),
});

type FormValues = z.infer<typeof schema>;

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics", "Science"]; // local: includes Science
const CLASS_LEVELS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];

interface Props {
  trigger: React.ReactNode;
}

const EducatorApplicationDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      candidate_name: "",
      email: "",
      contact_no: "",
      alt_contact_no: "",
      subject: "",
      class_level: [],
      highest_qualification: "",
      other_qualification: "",
      current_organization: "",
      previous_organization: "",
      demo_video_link: "",
    },
  });

  const uploadFile = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("educator-uploads").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("educator-uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // Duplicate check: same email or contact_no already submitted
      const { data: alreadyExists, error: dupErr } = await supabase.rpc(
        "educator_application_exists",
        { _email: values.email, _contact_no: values.contact_no }
      );

      if (dupErr) throw dupErr;
      if (alreadyExists) {
        toast.error("Application already submitted", {
          description: "An application with this email or contact number already exists. Our team will get back to you soon.",
        });
        setSubmitting(false);
        return;
      }

      const photoFile = values.photo[0];
      const resumeFile = values.resume[0];

      const [photo_url, resume_url] = await Promise.all([
        uploadFile(photoFile, "photos"),
        uploadFile(resumeFile, "resumes"),
      ]);

      const { error } = await supabase.from("educator_applications").insert({
        candidate_name: values.candidate_name,
        email: values.email,
        date_of_birth: format(values.date_of_birth, "yyyy-MM-dd"),
        contact_no: values.contact_no,
        alt_contact_no: values.alt_contact_no || null,
        subject: values.subject,
        class_level: values.class_level,
        highest_qualification: values.highest_qualification,
        other_qualification: values.other_qualification || null,
        current_organization: values.current_organization || null,
        previous_organization: values.previous_organization || null,
        total_experience: values.total_experience,
        current_ctc: values.current_ctc ?? null,
        expected_ctc: values.expected_ctc,
        photo_url,
        resume_url,
        demo_video_link: values.demo_video_link,
      });

      if (error) throw error;

      // Mock-auth as a teacher in local store so dashboard shows their info
      setUser({
        id: crypto.randomUUID(),
        full_name: values.candidate_name,
        email: values.email,
        role: "teacher",
        target_exam: values.subject,
        avatar_url: photo_url,
      });

      toast.success("Application submitted!", {
        description: "Thanks for applying to ARKE. Our team will review and get back within 5–7 working days.",
      });
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed";
      toast.error("Could not submit application", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-display">Join as an Educator</DialogTitle>
              <DialogDescription>Fill in your details to start teaching with ARKE.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
            {/* Personal */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="candidate_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Candidate Name *</FormLabel>
                  <FormControl><Input placeholder="Your full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(d) => d > new Date() || d < new Date("1940-01-01")}
                        captionLayout="dropdown-buttons"
                        fromYear={1940}
                        toYear={new Date().getFullYear()}
                        defaultMonth={field.value ?? new Date(2000, 0)}
                        initialFocus
                        classNames={{
                          caption_label: "hidden",
                          caption_dropdowns: "flex gap-2 justify-center",
                          dropdown: "rounded-md border border-input bg-background px-2 py-1 text-sm font-medium",
                          dropdown_month: "relative",
                          dropdown_year: "relative",
                        }}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_no" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact No *</FormLabel>
                  <FormControl><Input type="tel" placeholder="+91 98765 43210" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="alt_contact_no" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alternative Contact No</FormLabel>
                  <FormControl><Input type="tel" placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select your subject" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="class_level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class Level * <span className="text-xs text-muted-foreground font-normal">(select all that apply)</span></FormLabel>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-input p-3">
                    {CLASS_LEVELS.map((c) => {
                      const checked = field.value?.includes(c) ?? false;
                      return (
                        <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const curr = field.value ?? [];
                              field.onChange(v ? [...curr, c] : curr.filter((x: string) => x !== c));
                            }}
                          />
                          <span>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Qualifications */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="highest_qualification" render={({ field }) => (
                <FormItem>
                  <FormLabel>Highest Qualification *</FormLabel>
                  <FormControl><Input placeholder="e.g. M.Sc. Physics, IIT Delhi" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="other_qualification" render={({ field }) => (
                <FormItem>
                  <FormLabel>Other Qualification</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="current_organization" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Organization</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="previous_organization" render={({ field }) => (
                <FormItem>
                  <FormLabel>Previous Organization</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Experience & CTC */}
            <div className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="total_experience" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Experience (yrs) *</FormLabel>
                  <FormControl><Input type="number" min="0" step="0.5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="current_ctc" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current CTC (₹/month)</FormLabel>
                  <FormControl><Input type="number" min="0" placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expected_ctc" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected CTC (₹/month) *</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Uploads + video */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="photo" render={({ field: { onChange } }) => (
                <FormItem>
                  <FormLabel>Photo Upload * <span className="text-xs text-muted-foreground">(≤ 2MB image)</span></FormLabel>
                  <FormControl>
                    <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resume" render={({ field: { onChange } }) => (
                <FormItem>
                  <FormLabel>Resume Upload * <span className="text-xs text-muted-foreground">(PDF/DOC, ≤ 5MB)</span></FormLabel>
                  <FormControl>
                    <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => onChange(e.target.files)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demo_video_link" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Demo Video Link *</FormLabel>
                  <FormControl><Input type="url" placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Upload className="h-4 w-4" /> Submit Application</>}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EducatorApplicationDialog;
