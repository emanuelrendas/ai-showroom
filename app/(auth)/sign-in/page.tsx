import { SignInForm } from "@/features/auth/sign-in-form";
import { PRODUCT_NAME } from "@/lib/product";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-[0.3em] text-neutral-500">RAIOC</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Secure access to the shared operating environment.
          </p>
        </div>

        <Card className="border-neutral-800 bg-neutral-900/60 text-neutral-100 shadow-2xl">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your account credentials to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
