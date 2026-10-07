export function RouteLoading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="space-y-8">
    <p className="text-sm text-text-secondary">Loading your work…</p>
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-3 border-b border-border pb-8"><div className="loading-placeholder h-3 w-36" /><div className="loading-placeholder h-8 w-2/3 max-w-sm" /></div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-6"><div className="loading-placeholder h-5 w-1/3" /><div className="loading-placeholder h-4 w-3/4" /><div className="loading-placeholder h-4 w-1/2" /></div>
    </div>
  </div>;
}
