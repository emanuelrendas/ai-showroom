"use client";

import { useActionState } from "react";
import { createProjectAction, type ProjectActionState } from "@/features/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreateProjectFormProps = {
  workspaceSlug: string;
};

const initialState: ProjectActionState = { error: null };

export function CreateProjectForm({ workspaceSlug }: CreateProjectFormProps) {
  const createProject = createProjectAction.bind(null, workspaceSlug);
  const [state, formAction, isPending] = useActionState(
    createProject,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          name="name"
          placeholder="AI Showroom"
          maxLength={80}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          placeholder="What is this project responsible for?"
          maxLength={500}
          rows={5}
        />
      </div>

      <div aria-live="polite" className="min-h-5 text-sm text-red-400">
        {state.error}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
