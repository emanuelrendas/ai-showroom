type PublicSupabaseEnvSource = Record<string, string | undefined>;

export function getPublicSupabaseEnv(
  source: PublicSupabaseEnvSource = process.env,
) {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    url,
    publishableKey,
  };
}
