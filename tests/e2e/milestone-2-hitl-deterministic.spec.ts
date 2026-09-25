import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// E1 — Happy path, per the 25 Sep 2026 M2 final acceptance dispatch, Block 3.
//
// This is the REQUIRED, deterministic automated suite target. It sets
// AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER=1 (see features/ai/provider.ts) so
// the app's server actions call the deterministic stub provider instead of
// the real Gemini endpoint: no live model call, no token cost, no network
// dependency on Gemini. The env var must be set for the `npm run start`
// process this spec is run against (documented in the runbook), NOT inside
// this file -- this file only asserts the resulting behavior.
//
// tests/e2e/milestone-2-hitl.spec.ts (the real-Gemini version) is the
// separate, OPTIONAL live-model smoke test the dispatch allows. It is never
// run as part of this deterministic suite and never required for this
// suite's success.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Missing E2E Supabase environment variables.");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test("E1 — full HITL cycle against the deterministic stub provider (generate, approve, verify)", async ({
  page,
}) => {
  const runId = randomUUID().replaceAll("-", "");
  const email = `e2e-det-${runId}@example.com`;
  const password = `Test!${randomUUID()}Aa1`;
  const workspaceSlug = `e2e-det-${runId}`;

  let userId = "";
  let missionId = "";

  try {
    // --- Step 1: member signs in ---
    const createdUser = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createdUser.error || !createdUser.data.user) {
      throw new Error(
        `Unable to create E2E user: ${createdUser.error?.message ?? "unknown error"}`,
      );
    }

    userId = createdUser.data.user.id;

    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/app$/);

    // --- Step 2: member reaches correct workspace/project/mission ---
    await page.getByLabel("Workspace name").fill(`E2E Deterministic ${runId}`);
    await page.getByLabel("Workspace slug").fill(workspaceSlug);
    await page.getByRole("button", { name: /create workspace/i }).click();

    await expect(page).toHaveURL(new RegExp(`/w/${workspaceSlug}$`));

    await page.getByLabel("Project name").fill("AI Showroom E2E Deterministic");
    await page
      .getByLabel("Description")
      .fill("Temporary project created by the deterministic HITL E2E test.");
    await page.getByRole("button", { name: /create project/i }).click();

    await expect(
      page.getByRole("heading", { name: "AI Showroom E2E Deterministic" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /AI Showroom E2E Deterministic/i }).click();

    await page.getByLabel("Mission title").fill("Verify Deterministic HITL Cycle");
    await page
      .getByLabel("Description")
      .fill("Verify Generate -> Approve against the deterministic stub provider.");
    await page.getByLabel("Status").selectOption("in_progress");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByRole("button", { name: /create mission/i }).click();

    await expect(
      page.getByRole("heading", { name: "Verify Deterministic HITL Cycle" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Verify Deterministic HITL Cycle/i }).click();

    // --- Step 3: member submits AI draft generation request ---
    await page
      .getByLabel("Context for the model")
      .fill(
        "Deterministic E2E fixture context: verifying the full generate, review, " +
          "and approve cycle against the stub provider, with no live network call.",
      );

    const generateButton = page.getByRole("button", { name: /generate ai draft/i });
    await generateButton.click();
    // Deterministic and instant: no retry loop needed, but a generous timeout
    // covers CI/local machine variance in the Next.js server action round trip.
    await expect(generateButton).toBeEnabled({ timeout: 15_000 });

    const errorRegion = page.locator('[role="status"][aria-live="polite"]').first();
    const errorText = (await errorRegion.textContent())?.trim();
    if (errorText) {
      throw new Error(`Deterministic draft generation reported an error: ${errorText}`);
    }

    // --- Steps 4-7: stub returns valid output, wrapper accepts it, telemetry
    // lands in inference_logs, mission_ai_drafts row created pending_review ---
    await expect(page.getByText("Pending review").first()).toBeVisible({
      timeout: 10_000,
    });

    // --- Step 8: human approver sees the draft (already asserted above via
    // the visible "Pending review" card and its Approve button below) ---
    const approveButton = page.getByRole("button", { name: /^approve$/i }).first();
    await expect(approveButton).toBeVisible();

    // --- Step 9-11: human explicitly approves, via the canonical RPC, with
    // approval evidence recorded (verified at the DB layer below, not only
    // by the UI's word) ---
    await approveButton.click();

    // --- Step 12: final UI state reflects the approved result ---
    await expect(page.getByText(/^applied$/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);

    // --- Independent DB-level verification, not just trusting the UI ---
    const missionsResult = await admin
      .from("missions")
      .select("id")
      .eq("title", "Verify Deterministic HITL Cycle")
      .single();
    if (missionsResult.error || !missionsResult.data) {
      throw new Error(
        `Unable to look up mission for DB verification: ${missionsResult.error?.message ?? "not found"}`,
      );
    }
    missionId = missionsResult.data.id;

    const logResult = await admin
      .from("inference_logs")
      .select("status, model_identifier, mission_id")
      .eq("mission_id", missionId)
      .single();

    expect(logResult.error).toBeNull();
    expect(logResult.data?.status).toBe("success");
    // Proves the deterministic stub was actually used, not the real Gemini
    // endpoint -- a live call would record "gemini-3.6-flash" here instead.
    expect(logResult.data?.model_identifier).toBe("deterministic-stub-v1");

    const draftResult = await admin
      .from("mission_ai_drafts")
      .select("status, approved_by, approved_at, is_ai_generated")
      .eq("mission_id", missionId)
      .single();

    expect(draftResult.error).toBeNull();
    expect(draftResult.data?.status).toBe("applied");
    expect(draftResult.data?.is_ai_generated).toBe(true);
    expect(draftResult.data?.approved_by).toBe(userId);
    expect(draftResult.data?.approved_at).not.toBeNull();
  } finally {
    if (userId) {
      try {
        const signedIn = createClient(supabaseUrl, publishableKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const signInResult = await signedIn.auth.signInWithPassword({ email, password });
        if (signInResult.error) throw new Error(signInResult.error.message);

        const workspaceResult = await signedIn
          .from("workspaces")
          .select("id")
          .eq("created_by", userId)
          .maybeSingle();
        if (workspaceResult.error) throw new Error(workspaceResult.error.message);

        if (workspaceResult.data?.id) {
          const deleteWorkspaceResult = await signedIn
            .from("workspaces")
            .delete()
            .eq("id", workspaceResult.data.id);
          if (deleteWorkspaceResult.error) throw new Error(deleteWorkspaceResult.error.message);
        }

        const deleteUserResult = await admin.auth.admin.deleteUser(userId);
        if (deleteUserResult.error) throw new Error(deleteUserResult.error.message);
      } catch (error) {
        // Same expected residue as tests/e2e/milestone-2-hitl.spec.ts:
        // inference_logs uses ON DELETE RESTRICT (Section 6), so cleanup can
        // legitimately fail once a real telemetry row references the
        // workspace hierarchy. That is the immutable-audit-trail guarantee
        // holding, not a test bug.
        console.warn(
          `Expected cleanup residue (inference_logs RESTRICT + append-only guarantee): ` +
            `${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
});
