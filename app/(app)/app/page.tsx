import { signOutAction } from "@/features/auth/actions";
import { PRODUCT_NAME } from "@/lib/product";
import { Button } from "@/components/ui/button";

export default function AppPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="text-center">
        <p className="text-xs tracking-[0.3em] text-neutral-500">RAIOC</p>
        <h1 className="mt-3 text-3xl font-semibold">{PRODUCT_NAME}</h1>
        <p className="mt-3 text-sm text-neutral-400">Authenticated foundation.</p>

        <form action={signOutAction} className="mt-8">
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
    </main>
  );
}
