import type { Database } from "@/lib/supabase/database.types";

export type Project =
  Database["public"]["Tables"]["projects"]["Row"];
