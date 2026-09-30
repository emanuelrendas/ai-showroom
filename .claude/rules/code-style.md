---
paths:
  - "app/**"
  - "components/**"
  - "features/**"
  - "lib/**"
  - "tools/**"
  - "proxy.ts"
---

# Code style

- Next.js 16 differs from training data: check `node_modules/next/dist/docs/` before using a routing, caching or proxy API (the middleware file is `proxy.ts`).
- Feature code lives in `features/<domain>/` with the existing split: `actions.ts` (`"use server"`), `queries.ts`, `schema.ts` (Zod), `types.ts`, and `*-form.tsx` / UI components. Follow it; do not invent new layers.
- Validate every Server Action input with the domain's Zod schema (`safeParse`), return `{ error: string | null }`-style state, never raw errors.
- Supabase clients only via `lib/supabase/{server,client,proxy}.ts`. Browser code uses the publishable key only; the secret key is never imported into app code.
- Env access through `lib/env.ts` helpers, not scattered `process.env` reads.
- Shared primitives in `components/ui/` (shadcn). Reuse before adding.
- TypeScript strict, no `any` without a justifying comment. `@/` path alias.
- Files use LF (`.gitattributes`). Keep diffs small and bounded to the mission.
