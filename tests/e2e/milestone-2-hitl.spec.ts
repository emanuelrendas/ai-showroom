import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("Missing E2E Supabase environment variables.");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Real gemini-3.6-flash calls (~3-5s each, occasionally slower or
// transiently 503) plus a full browser journey (sign-in, workspace, project,
// mission, two generations, approve, dismiss) does not fit in the project's
// default 30s test timeout. No mocks, no injected test double -- this hits
// the real provider, per the ratified decision.
test.setTimeout(120_000);

test("Milestone 2 HITL browser journey with a real Gemini call", async ({ page }) => {
  const runId = randomUUID().replaceAll("-", "");
  const email = `e2e-hitl-${runId}@example.com`;
  const password = `Test!${randomUUID()}Aa1`;
  const workspaceSlug = `e2e-hitl-${runId}`;

  let userId = "";

  try {
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

    await page.getByLabel("Workspace name").fill(`E2E HITL Workspace ${runId}`);
    await page.getByLabel("Workspace slug").fill(workspaceSlug);
    await page.getByRole("button", { name: /create workspace/i }).click();

    await expect(page).toHaveURL(new RegExp(`/w/${workspaceSlug}$`));

    await page.getByLabel("Project name").fill("AI Showroom E2E HITL");
    await page
      .getByLabel("Description")
      .fill("Temporary project created by the Milestone 2 HITL browser test.");
    await page.getByRole("button", { name: /create project/i }).click();

    await expect(
      page.getByRole("heading", { name: "AI Showroom E2E HITL" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /AI Showroom E2E HITL/i }).click();

    await page.getByLabel("Mission title").fill("Verify Real Gemini HITL Cycle");
    await page
      .getByLabel("Description")
      .fill("Verify Generate -> Approve/Dismiss against the real Gemini provider.");
    await page.getByLabel("Status").selectOption("in_progress");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByRole("button", { name: /create mission/i }).click();

    await expect(
      page.getByRole("heading", { name: "Verify Real Gemini HITL Cycle" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Verify Real Gemini HITL Cycle/i }).click();

    // --- Draft 1: generate, then Approve ---
    await page
      .getByLabel("Context for the model")
      .fill(
        "The team shipped the new onboarding flow this week. Signups are up 12% " +
          "but activation rate dropped slightly, likely due to a confusing email " +
          "verification step. We need to decide whether to roll back the email " +
          "step or patch the copy.",
      );

    await generateDraftWithRetry(page);

    await expect(page.getByText("Pending review").first()).toBeVisible({
      timeout: 30_000,
    });

    const approveButton = page.getByRole("button", { name: /^approve$/i }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    await expect(page.getByText(/^applied$/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);

    // --- Draft 2: generate, then Dismiss ---
    await page
      .getByLabel("Context for the model")
      .fill(
        "A customer flagged that the invoice PDF export is missing the tax " +
          "breakdown line items. This affects their monthly reconciliation. " +
          "Need to triage severity and next steps.",
      );

    await generateDraftWithRetry(page);

    await expect(page.getByText("Pending review").first()).toBeVisible({
      timeout: 30_000,
    });

    const dismissButton = page.getByRole("button", { name: /^dismiss$/i }).first();
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();

    await expect(page.getByText(/^dismissed$/i).first()).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    // ai_inference_logs uses ON DELETE RESTRICT (Section 6.1) -- once a real
    // inference call is logged against this workspace, deleting it (and the
    // owner's Auth user, which cascades toward it) is expected to fail. That
    // is the immutable-audit-trail guarantee holding, not a bug. Caught and
    // logged, never silently swallowed and never re-thrown as a test failure.
    if (userId) {
      try {
        const signedIn = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
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
        console.warn(
          `Expected cleanup residue (ai_inference_logs RESTRICT + append-only guarantee): ` +
            `${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
});

async function generateDraftWithRetry(page: import("@playwright/test").Page) {
  const generateButton = page.getByRole("button", { name: /generate ai draft/i });

  for (let attempt = 1; attempt <= 2; attempt++) {
    await generateButton.click();
    await expect(generateButton).toBeEnabled({ timeout: 30_000 });

    const errorRegion = page.locator('[role="status"][aria-live="polite"]').first();
    const errorText = (await errorRegion.textContent())?.trim();

    if (!errorText) return; // no error shown -> generation succeeded
    if (attempt === 2) {
      throw new Error(`Draft generation failed after retry: ${errorText}`);
    }
    console.warn(`Draft generation attempt ${attempt} failed transiently: ${errorText}. Retrying.`);
  }
}
