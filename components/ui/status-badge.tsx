import { Badge } from "@/components/ui/badge";

const tones: Record<string, string> = {
  active: "border-success/20 bg-success/5 text-success",
  in_progress: "border-primary/20 bg-primary/5 text-primary",
  done: "border-success/20 bg-success/5 text-success",
  applied: "border-success/20 bg-success/5 text-success",
  blocked: "border-warning/20 bg-warning/5 text-warning",
  pending_review: "border-warning/20 bg-warning/5 text-warning",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");
  return <Badge variant="outline" className={`h-7 gap-1.5 px-2.5 text-[13px] ${tones[status] ?? "text-text-secondary"}`}>
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {label.charAt(0).toUpperCase() + label.slice(1)}
  </Badge>;
}

export function PriorityLabel({ priority }: { priority: string }) {
  return <span className={`text-[13px] ${priority === "critical" ? "text-error" : priority === "high" ? "text-warning" : "text-text-secondary"}`}>
    {priority.charAt(0).toUpperCase() + priority.slice(1)} priority
  </span>;
}
