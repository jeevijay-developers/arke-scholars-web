import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CourseRow } from "./useCourses";

export type LessonRow = {
  id: string;
  chapter_id: string;
  course_id: string;
  slug: string;
  title: string;
  position: number;
  duration_seconds: number;
  video_url: string | null;
  is_free_preview: boolean;
  type: string;
};

export type ChapterRow = {
  id: string;
  course_id: string;
  title: string;
  position: number;
  lessons: LessonRow[];
};

export type CoursePdfRow = {
  id: string;
  course_id: string;
  title: string;
  file_url: string;
  size_bytes: number | null;
  position: number;
};

export type NoteRow = {
  id: string;
  course_id: string;
  title: string;
  file_url: string;
  size_bytes: number | null;
  position: number;
};

export const useCourseDetail = (slug: string | undefined) => {
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [pdfs, setPdfs] = useState<CoursePdfRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);

      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (!courseData) {
        setCourse(null);
        setChapters([]);
        setPdfs([]);
        setNotes([]);
        setTests([]);
        setReviewCount(0);
        setLoading(false);
        return;
      }
      setCourse(courseData as CourseRow);

      const { data: chs } = await supabase
        .from("chapters")
        .select("id, course_id, title, position")
        .eq("course_id", courseData.id)
        .order("position");

      const chapterIds = (chs ?? []).map((c) => c.id);
      const { data: lessons } = chapterIds.length
        ? await supabase
            .from("lessons")
            .select("id, chapter_id, course_id, slug, title, position, duration_seconds, video_url, is_free_preview, type")
            .in("chapter_id", chapterIds)
            .order("position")
        : { data: [] as LessonRow[] };

      const grouped: ChapterRow[] = (chs ?? []).map((c) => ({
        ...c,
        lessons: ((lessons ?? []) as LessonRow[]).filter((l) => l.chapter_id === c.id),
      }));
      setChapters(grouped);

      const { data: pdfResourceData } = await supabase
        .from("course_resources")
        .select("id, course_id, title, file_url, file_size_bytes, position")
        .eq("course_id", courseData.id)
        .eq("resource_type", "pdf")
        .eq("is_published", true)
        .order("position");
      setPdfs(((pdfResourceData ?? []) as any[]).map(p => ({
        ...p,
        size_bytes: p.file_size_bytes
      })) as CoursePdfRow[]);

      const { data: resourceData } = await supabase
        .from("course_resources")
        .select("id, course_id, title, file_url, file_size_bytes, position")
        .eq("course_id", courseData.id)
        .in("resource_type", ["pdf", "notes"])
        .eq("is_published", true)
        .order("position");
      const resourceNotes = (resourceData ?? []).map((r: any) => ({
        id: r.id,
        course_id: r.course_id,
        title: r.title,
        file_url: r.file_url,
        size_bytes: r.file_size_bytes,
        position: r.position,
      }));
      setNotes(resourceNotes as NoteRow[]);

      const { data: testData } = await supabase
        .from("tests")
        .select("id, slug, title, test_type, duration_minutes, total_questions, total_marks, is_published")
        .eq("course_id", courseData.id)
        .eq("is_published", true);
      setTests(testData ?? []);

      const { count: rCount } = await supabase
        .from("course_reviews")
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseData.id);
      setReviewCount(rCount ?? 0);

      setLoading(false);
    };
    load();
  }, [slug]);

  return { course, chapters, pdfs, notes, tests, reviewCount, loading };
};
