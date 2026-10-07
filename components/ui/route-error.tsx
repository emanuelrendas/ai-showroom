"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="state-entry mx-auto max-w-xl rounded-xl border border-error/20 bg-surface p-6 sm:p-8">
    <div role="alert"><p className="eyebrow text-error">Unable to load</p><h2 className="mt-3 text-xl font-semibold">This view couldn’t be loaded.</h2><p className="mt-3 text-sm leading-6 text-text-secondary">Try loading it again, or return to your workspaces.</p></div>
    <div className="mt-6 flex flex-wrap items-center gap-5"><Button onClick={reset}>Try again</Button><Link href="/app" className="inline-flex min-h-11 items-center rounded-md text-sm text-text-secondary hover:text-foreground">Your workspaces</Link></div>
  </section>;
}
