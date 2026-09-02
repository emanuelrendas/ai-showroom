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

test("Milestone 1 browser journey", async ({ page }) => {
  const runId = randomUUID().replaceAll("-", "");
  const email = `e2e-${runId}@example.com`;
  const password = `Test!${randomUUID()}Aa1`;
  const workspaceSlug = `e2e-${runId}`;

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

    await page.getByLabel("Workspace name").fill(`E2E Workspace ${runId}`);
    await page.getByLabel("Workspace slug").fill(workspaceSlug);
    await page.getByRole("button", { name: /create workspace/i }).click();

    await expect(page).toHaveURL(new RegExp(`/w/${workspaceSlug}$`));

    await page.getByLabel("Project name").fill("AI Showroom E2E");
    await page
      .getByLabel("Description")
      .fill("Temporary project created by the browser acceptance test.");
    await page.getByRole("button", { name: /create project/i }).click();

    await expect(
      page.getByRole("heading", { name: "AI Showroom E2E" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /AI Showroom E2E/i }).click();

    await page.getByLabel("Mission title").fill("Build Browser Acceptance");
    await page
      .getByLabel("Description")
      .fill("Verify the complete Milestone 1 browser journey.");
    await page.getByLabel("Status").selectOption("in_progress");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByRole("button", { name: /create mission/i }).click();

    await expect(
      page.getByRole("heading", { name: "Build Browser Acceptance" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Build Browser Acceptance/i }).click();

    await expect(
      page.getByRole("heading", { name: "Build Browser Acceptance" }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("heading", { name: "Build Browser Acceptance" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto(`/w/${workspaceSlug}`);

    await expect(page).toHaveURL(/\/sign-in$/);
  } finally {
    if (userId) {
      const signedIn = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

      const signInResult = await signedIn.auth.signInWithPassword({
        email,
        password,
      });

      if (signInResult.error) {
        throw new Error(
          `Unable to sign in E2E user for cleanup: ${signInResult.error.message}`,
        );
      }

      const workspaceResult = await signedIn
        .from("workspaces")
        .select("id")
        .eq("created_by", userId)
        .maybeSingle();

      if (workspaceResult.error) {
        throw new Error(
          `Unable to locate E2E workspace for cleanup: ${workspaceResult.error.message}`,
        );
      }

      if (workspaceResult.data?.id) {
        const deleteWorkspaceResult = await signedIn
          .from("workspaces")
          .delete()
          .eq("id", workspaceResult.data.id);

        if (deleteWorkspaceResult.error) {
          throw new Error(
            `Unable to delete E2E workspace: ${deleteWorkspaceResult.error.message}`,
          );
        }

        const verifyWorkspaceResult = await signedIn
          .from("workspaces")
          .select("id")
          .eq("id", workspaceResult.data.id);

        if (verifyWorkspaceResult.error) {
          throw new Error(
            `Unable to verify E2E workspace cleanup: ${verifyWorkspaceResult.error.message}`,
          );
        }

        if ((verifyWorkspaceResult.data?.length ?? 0) !== 0) {
          throw new Error("E2E workspace cleanup did not remove the workspace.");
        }
      }

      const deleteUserResult = await admin.auth.admin.deleteUser(userId);

      if (deleteUserResult.error) {
        throw new Error(
          `Unable to delete E2E Auth user: ${deleteUserResult.error.message}`,
        );
      }
    }
  }
});
