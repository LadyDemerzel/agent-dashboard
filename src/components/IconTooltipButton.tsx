"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IconTooltipButtonProps
  extends Omit<ButtonProps, "children" | "size"> {
  icon: LucideIcon;
  tooltip: string;
  label?: string;
  iconClassName?: string;
}

export function IconTooltipButton({
  icon: Icon,
  tooltip,
  label,
  iconClassName,
  variant = "ghost",
  type = "button",
  className,
  ...props
}: IconTooltipButtonProps) {
  const tooltipId = React.useId();
  const ariaLabel = label || tooltip;

  return (
    <span className="group relative inline-flex shrink-0">
      <Button
        {...props}
        type={type}
        variant={variant}
        size="icon"
        aria-describedby={tooltipId}
        aria-label={ariaLabel}
        className={cn(
          "h-9 w-9 shrink-0 rounded-full border-0 shadow-none",
          className,
        )}
      >
        <Icon aria-hidden="true" className={cn("h-4 w-4", iconClassName)} />
      </Button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
}
