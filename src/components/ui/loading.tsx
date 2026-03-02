import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-md border border-border", className)} aria-hidden="true" />;
}

export function OrbitLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6" role="status" aria-live="polite">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border border-zinc-500/35 animate-spin" />
        <div
          className="absolute inset-1 rounded-full border border-zinc-300/25"
          style={{ animation: "spin 1.8s linear infinite reverse" }}
        />
        <div className="absolute inset-[31%] rounded-full bg-zinc-300/55 blur-[1px] animate-pulse" />
      </div>
      <p className="text-xs tracking-[0.14em] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

export function PageLoadingShell() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
      <div className="w-full space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[24rem] lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
        </div>

        <OrbitLoader label="Loading dashboard" />
      </div>
    </div>
  );
}
