import type { Database } from "@/lib/supabase/database.types";

export type MissionAiDraft =
  Database["public"]["Tables"]["mission_ai_drafts"]["Row"];
