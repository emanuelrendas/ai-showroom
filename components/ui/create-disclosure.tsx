import { Plus } from "lucide-react";

export function CreateDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="create-disclosure group mt-6 border-t border-border pt-4">
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-foreground [&::-webkit-details-marker]:hidden">
      <Plus size={16} aria-hidden="true" className="transition-transform duration-[var(--motion-fast)] group-open:rotate-45" />
      {label}
    </summary>
    <div className="state-entry mt-3 max-w-xl rounded-xl border border-border bg-surface p-5 sm:p-6">{children}</div>
  </details>;
}
