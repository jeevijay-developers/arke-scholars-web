import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PublicEducator = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  subject: string | null;
  bio: string | null;
  city: string | null;
};

/**
 * Public list of users with role=teacher. Reads from profiles + user_roles.
 * Falls back to empty list — pages should render a curated fallback if needed.
 */
export const useEducators = () => {
  const [educators, setEducators] = useState<PublicEducator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) {
        if (!ignore) {
          setEducators([]);
          setLoading(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, target_exam, city")
        .in("user_id", ids);
      const list = (profs ?? [])
        .filter((p: any) => p.full_name)
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url ?? null,
          subject: null, // profiles has no subject column; fall back to N/A
          bio: null,
          city: p.city ?? null,
        })) as PublicEducator[];
      if (!ignore) {
        setEducators(list);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return { educators, loading };
};
