import Link from "next/link";
import { ArrowRight, Layers2, LayoutGrid, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { CreateDisclosure } from "@/components/ui/create-disclosure";

export default async function AppPage() {
  const workspaces = await getMyWorkspaces();
  return (
    <div className="entry-shell studio-shell">
      <aside className="entry-navigation">
        <Link href="/app" aria-label="AI SHOWROOM, all workspaces" className="flex items-center gap-3 rounded-lg">
          <span aria-hidden="true" className="studio-mark flex size-10 shrink-0 items-center justify-center rounded-lg font-bold">AI</span>
          <span className="text-[13px] font-semibold tracking-[0.04em]">AI SHOWROOM</span>
        </Link>
        <nav aria-label="Workspace selection" className="mt-10">
          <Link href="/app" aria-current="page" className="shell-nav-link"><LayoutGrid size={18} aria-hidden="true" />Workspaces</Link>
        </nav>
      </aside>
      <main className="entry-main">
        <div className="entry-layout page-entry">
          <header className="entry-intro studio-atmosphere">
            <p className="eyebrow text-primary">AI SHOWROOM</p>
            <h1 className="entry-heading">Focused work.<br /><span>Human direction.</span></h1>
            <p className="entry-description">An AI workspace for your projects and missions. Shape the context, generate a draft, and decide what moves forward.</p>
          </header>
          <section aria-labelledby="workspaces-heading" className="entry-selection">
            <div className="mb-6"><p className="eyebrow text-text-secondary">Operating environments</p><h2 id="workspaces-heading" className="mt-2 text-2xl font-semibold tracking-tight">Your workspaces</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Choose a workspace to continue.</p></div>
            {workspaces.length > 0 ? <>
              <ul aria-label="Workspaces" className="workspace-list">
                {workspaces.map((workspace) => <li key={workspace.id}>
                  <Link href={`/w/${workspace.slug}`} className="workspace-record group">
                    <span aria-hidden="true" className="workspace-emblem"><Layers2 size={22} /></span>
                    <div className="min-w-0 flex-1"><h3 className="record-title">{workspace.name}</h3><p className="mt-2 break-all text-[13px] text-text-secondary">/{workspace.slug}</p></div>
                    <span className="workspace-open">Open workspace<ArrowRight aria-hidden="true" size={16} className="row-arrow" /></span>
                  </Link>
                </li>)}
              </ul>
              <CreateDisclosure label="Create workspace"><CreateWorkspaceForm /></CreateDisclosure>
            </> : <div className="empty-surface">
              <h3 className="text-lg font-semibold">Create the first workspace</h3>
              <p className="mb-6 mt-2 text-sm leading-6 text-text-secondary">Give your projects and missions a shared operating environment.</p>
              <CreateWorkspaceForm />
            </div>}
          </section>
          <div className="entry-principles">
            <div><ScanLine size={20} aria-hidden="true" /><h2>Focused</h2><p>Projects and missions give work its context.</p></div>
            <div><Sparkles size={20} aria-hidden="true" /><h2>AI-assisted</h2><p>Generate drafts from the material you provide.</p></div>
            <div><ShieldCheck size={20} aria-hidden="true" /><h2>Human-reviewed</h2><p>Review each result before approving it.</p></div>
          </div>
        </div>
      </main>
    </div>
  );
}
