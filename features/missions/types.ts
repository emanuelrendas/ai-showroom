import type { Database } from "@/lib/supabase/database.types";

export type Mission =
  Database["public"]["Tables"]["missions"]["Row"];
