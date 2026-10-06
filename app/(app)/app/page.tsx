import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AppPage() {
  const workspaces = await getMyWorkspaces();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 border-b border-border pb-8">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary">AI SHOWROOM</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{PRODUCT_NAME}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Choose an operating workspace to continue.</p>
        </header>

        {workspaces.length > 0 ? (
          <section>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Workspaces</p>
              <h2 className="mt-2 text-xl font-medium">Available workspaces</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <Link key={workspace.id} href={`/w/${workspace.slug}`} className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
                  <Card className="h-full border border-border bg-surface text-foreground transition-colors duration-[var(--motion-nav)] hover:border-primary/60 hover:bg-surface-raised">
                    <CardHeader>
                      <CardTitle>{workspace.name}</CardTitle>
                      <CardDescription>/{workspace.slug}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="max-w-xl">
            <Card className="border border-border bg-surface text-foreground">
              <CardHeader>
                <CardTitle>Create the first workspace</CardTitle>
                <CardDescription>
                  Establish the shared RAIOC operating environment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateWorkspaceForm />
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
