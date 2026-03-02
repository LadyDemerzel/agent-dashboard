import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TabTransition({
  transitionKey,
  className,
  children,
}: {
  transitionKey: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div key={transitionKey} className={cn("tab-switch-motion", className)}>
      {children}
    </div>
  );
}
