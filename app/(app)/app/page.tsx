import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AppPage() {
  const workspaces = await getMyWorkspaces();

  return (
    <main className="min-h-screen bg-neutral-950 px-8 py-10 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 border-b border-neutral-800 pb-6">
          <p className="text-xs tracking-[0.3em] text-neutral-500">RAIOC OPERATING ENVIRONMENT</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        </header>

        {workspaces.length > 0 ? (
          <section>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Workspaces</p>
              <h2 className="mt-2 text-xl font-medium">Available environments</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <Link key={workspace.id} href={`/w/${workspace.slug}`}>
                  <Card className="h-full border-neutral-800 bg-neutral-900/60 text-neutral-100 transition hover:border-neutral-600">
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
            <Card className="border-neutral-800 bg-neutral-900/60 text-neutral-100">
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
