"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type WorkspaceActionState } from "@/features/workspaces/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: WorkspaceActionState = { error: null };

export function CreateWorkspaceForm() {
  const [state, formAction, isPending] = useActionState(
    createWorkspaceAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" placeholder="Workspace name" maxLength={80} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Workspace slug</Label>
        <Input id="slug" name="slug" placeholder="workspace-name" required />
      </div>

      <div aria-live="polite" className="min-h-5 text-sm text-error">
        {state.error}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create workspace"}
      </Button>
    </form>
  );
}

