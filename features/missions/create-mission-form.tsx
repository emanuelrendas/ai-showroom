"use client";

import { useActionState } from "react";
import { createMissionAction, type MissionActionState } from "@/features/missions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreateMissionFormProps = {
  workspaceSlug: string;
  projectId: string;
};

const initialState: MissionActionState = { error: null };

export function CreateMissionForm({
  workspaceSlug,
  projectId,
}: CreateMissionFormProps) {
  const createMission = createMissionAction.bind(
    null,
    workspaceSlug,
    projectId,
  );
  const [state, formAction, isPending] = useActionState(
    createMission,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="mission-title">Mission title</Label>
        <Input
          id="mission-title"
          name="title"
          placeholder="Build Model Router"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mission-description">Description</Label>
        <Textarea
          id="mission-description"
          name="description"
          placeholder="Define the work this mission is responsible for."
          maxLength={1000}
          rows={5}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mission-status">Status</Label>
          <select
            id="mission-status"
            name="status"
            defaultValue="todo"
            className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-200"
          >
            <option value="todo">Todo</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mission-priority">Priority</Label>
          <select
            id="mission-priority"
            name="priority"
            defaultValue="medium"
            className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-200"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5 text-sm text-red-400">
        {state.error}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create mission"}
      </Button>
    </form>
  );
}
