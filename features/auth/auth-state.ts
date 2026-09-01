type ClaimsResult = {
  data: { claims?: { sub?: string } } | null;
  error: unknown;
};

export function userIdFromClaimsResult(result: ClaimsResult) {
  if (result.error) return null;
  return result.data?.claims?.sub ?? null;
}
