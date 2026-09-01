import Link from "next/link";
import { signOutAction } from "@/features/auth/actions";
import type { Workspace } from "@/features/workspaces/types";
import { Button } from "@/components/ui/button";

type WorkspaceShellProps = {
  workspace: Workspace;
  displayName: string;
  children: React.ReactNode;
};

export function WorkspaceShell({
  workspace,
  displayName,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="flex flex-col border-r border-neutral-800 bg-neutral-950 px-5 py-6">
          <div>
            <p className="text-xs tracking-[0.28em] text-neutral-500">AI SHOWROOM</p>
            <h1 className="mt-3 text-xl font-semibold">{workspace.name}</h1>
          </div>

          <nav className="mt-10 space-y-8">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                Workspace
              </p>
              <Link
                href={`/w/${workspace.slug}`}
                className="block rounded-md bg-neutral-900 px-3 py-2 text-sm"
              >
                Overview
              </Link>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                Projects
              </p>
              <p className="px-3 text-sm text-neutral-600">No projects yet</p>
            </div>
          </nav>

          <div className="mt-auto border-t border-neutral-800 pt-5">
            <p className="mb-3 text-sm text-neutral-400">{displayName}</p>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
