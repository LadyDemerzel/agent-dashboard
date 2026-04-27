"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RefreshIconButtonProps
  extends Omit<ButtonProps, "children" | "size"> {
  refreshing?: boolean;
  tooltip?: string;
  refreshingTooltip?: string;
  label?: string;
  iconClassName?: string;
}

export function RefreshIconButton({
  refreshing = false,
  tooltip = "Refresh",
  refreshingTooltip = "Refreshing…",
  label,
  iconClassName,
  variant = "outline",
  type = "button",
  className,
  disabled,
  ...props
}: RefreshIconButtonProps) {
  const tooltipId = React.useId();
  const ariaLabel = label || tooltip;
  const tooltipText = refreshing ? refreshingTooltip : tooltip;

  return (
    <span className="group relative inline-flex shrink-0">
      <Button
        {...props}
        type={type}
        variant={variant}
        size="icon"
        disabled={disabled}
        aria-busy={refreshing || undefined}
        aria-describedby={tooltipId}
        aria-label={refreshing ? `${ariaLabel} (refreshing)` : ariaLabel}
        className={cn("shrink-0", className)}
      >
        <RefreshCw
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            refreshing && "refresh-icon-button-refreshing",
            iconClassName,
          )}
        />
      </Button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltipText}
      </span>
    </span>
  );
}
