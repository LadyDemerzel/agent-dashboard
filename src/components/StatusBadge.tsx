import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { variant: "default" | "success" | "warning" | "destructive" | "info"; dot: string }> = {
  idle: { variant: "default", dot: "bg-zinc-500" },
  working: { variant: "success", dot: "bg-emerald-500" },
  review: { variant: "warning", dot: "bg-amber-500" },
  "needs review": { variant: "warning", dot: "bg-amber-500" },
  "requested changes": { variant: "destructive", dot: "bg-red-500" },
  blocked: { variant: "destructive", dot: "bg-red-500" },
  draft: { variant: "default", dot: "bg-zinc-500" },
  approved: { variant: "success", dot: "bg-emerald-500" },
  published: { variant: "info", dot: "bg-blue-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const safeStatus = status || "draft";
  const config = STATUS_CONFIG[safeStatus] || STATUS_CONFIG.idle;

  return (
    <Badge variant={config.variant}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          config.dot,
          safeStatus === "working" && "animate-pulse"
        )}
      />
      {safeStatus.replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}
