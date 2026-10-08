import { Plus } from "lucide-react";

export function CreateDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="create-disclosure group mt-6">
    <summary className="studio-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
      <Plus size={16} aria-hidden="true" className="transition-transform duration-[var(--motion-fast)] group-open:rotate-45" />
      {label}
    </summary>
    <div className="state-entry mt-4 max-w-xl rounded-xl border border-border-strong bg-surface-3 p-5 shadow-xl shadow-black/15 sm:p-6">{children}</div>
  </details>;
}
