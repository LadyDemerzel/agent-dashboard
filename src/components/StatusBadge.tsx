import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { variant: "default" | "success" | "warning" | "destructive" | "info"; dot: string; label?: string }> = {
  idle: { variant: "default", dot: "bg-zinc-500" },
  draft: { variant: "default", dot: "bg-zinc-500" },
  pending: { variant: "warning", dot: "bg-amber-500" },
  review: { variant: "warning", dot: "bg-amber-500" },
  "needs review": { variant: "warning", dot: "bg-amber-500" },
  working: { variant: "success", dot: "bg-emerald-500" },
  running: { variant: "success", dot: "bg-emerald-500", label: "In Progress" },
  "in-progress": { variant: "success", dot: "bg-emerald-500", label: "In Progress" },
  approved: { variant: "success", dot: "bg-emerald-500" },
  published: { variant: "info", dot: "bg-blue-500" },
  "requested changes": { variant: "destructive", dot: "bg-red-500" },
  blocked: { variant: "destructive", dot: "bg-red-500" },
  failed: { variant: "destructive", dot: "bg-red-500" },
};

export function StatusBadge({
  status,
  compact = false,
  className,
}: {
  status: string;
  compact?: boolean;
  className?: string;
}) {
  const safeStatus = status || "draft";
  const config = STATUS_CONFIG[safeStatus] || STATUS_CONFIG.idle;
  const label = config.label || safeStatus.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge
      variant={config.variant}
      className={cn(compact && "gap-1 px-2 py-0.5 text-[10px] leading-4", className)}
    >
      <span
        className={cn(
          compact ? "h-1.5 w-1.5" : "h-1.5 w-1.5",
          "rounded-full",
          config.dot,
          (safeStatus === "working" || safeStatus === "running" || safeStatus === "in-progress") && "animate-pulse"
        )}
      />
      {label}
    </Badge>
  );
}
