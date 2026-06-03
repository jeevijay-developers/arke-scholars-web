import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CourseBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Fetch course banners. Public callers get active banners only; admin passes includeInactive. */
export const useCourseBanners = (opts: { includeInactive?: boolean } = {}) => {
  const [banners, setBanners] = useState<CourseBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("course_banners").select("*").order("sort_order").order("created_at");
    if (!opts.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setBanners([]);
    } else {
      setBanners((data ?? []) as CourseBanner[]);
    }
    setLoading(false);
  }, [opts.includeInactive]);

  useEffect(() => { load(); }, [load]);

  return { banners, loading, error, reload: load };
};
