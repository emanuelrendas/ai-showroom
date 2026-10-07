import Link from "next/link";
import { ArrowRight, Layers2 } from "lucide-react";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { CreateDisclosure } from "@/components/ui/create-disclosure";

export default async function AppPage() {
  const workspaces = await getMyWorkspaces();
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-border pb-8">
          <p className="eyebrow text-primary">AI SHOWROOM</p>
          <h1 className="mt-6 text-[32px] font-semibold tracking-tight">Your workspaces</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">Choose or establish an operating environment.</p>
        </header>
        <div className="page-entry pt-8">
          {workspaces.length > 0 ? <>
            <h2 className="mb-4 text-sm font-medium text-text-secondary">Available workspaces</h2>
            <ul aria-label="Workspaces" className="operating-list">
              {workspaces.map((workspace) => <li key={workspace.id}>
                <Link href={`/w/${workspace.slug}`} className="operating-row group">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary"><Layers2 size={18} /></span>
                  <div className="min-w-0 flex-1"><h3 className="truncate text-base font-medium">{workspace.name}</h3><p className="mt-1 truncate text-xs text-text-secondary">/{workspace.slug}</p></div>
                  <span className="hidden text-xs text-text-secondary sm:block">Open workspace</span>
                  <ArrowRight aria-hidden="true" size={16} className="row-arrow" />
                </Link>
              </li>)}
            </ul>
            <CreateDisclosure label="Create workspace"><CreateWorkspaceForm /></CreateDisclosure>
          </> : <section className="max-w-xl rounded-xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-medium">Create the first workspace</h2>
            <p className="mb-6 mt-2 text-sm leading-6 text-text-secondary">Give your projects and missions a shared operating environment.</p>
            <CreateWorkspaceForm />
          </section>}
        </div>
      </div>
    </main>
  );
}
