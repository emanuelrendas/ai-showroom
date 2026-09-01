import { PRODUCT_NAME } from "@/lib/product";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center">
      <div className="text-center">
        <p className="text-xs tracking-[0.28em] text-neutral-500">RAIOC</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        <p className="mt-3 text-sm text-neutral-400">Foundation online.</p>
      </div>
    </main>
  );
}
