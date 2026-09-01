import { createClient } from "@/lib/supabase/server";

export async function getMyWorkspaces() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,created_by,created_at,updated_at")
    .order("name");

  if (error) throw new Error(`Unable to load workspaces: ${error.message}`);
  return data;
}

export async function getWorkspaceBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,created_by,created_at,updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Unable to load workspace: ${error.message}`);
  return data;
}
