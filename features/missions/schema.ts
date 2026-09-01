import { z } from "zod";

export const missionInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["todo", "in_progress", "blocked", "done", "cancelled"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
});
