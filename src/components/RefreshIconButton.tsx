"use client";

import { RefreshCw } from "lucide-react";
import {
  IconTooltipButton,
  type IconTooltipButtonProps,
} from "@/components/IconTooltipButton";
import { cn } from "@/lib/utils";

export interface RefreshIconButtonProps
  extends Omit<IconTooltipButtonProps, "icon" | "tooltip"> {
  refreshing?: boolean;
  tooltip?: string;
  refreshingTooltip?: string;
}

export function RefreshIconButton({
  refreshing = false,
  tooltip = "Refresh",
  refreshingTooltip = "Refreshing…",
  label,
  iconClassName,
  disabled,
  ...props
}: RefreshIconButtonProps) {
  const tooltipText = refreshing ? refreshingTooltip : tooltip;
  const ariaLabel = label || tooltip;

  return (
    <IconTooltipButton
      {...props}
      icon={RefreshCw}
      disabled={disabled}
      aria-busy={refreshing || undefined}
      tooltip={tooltipText}
      label={refreshing ? `${ariaLabel} (refreshing)` : ariaLabel}
      iconClassName={cn(
        refreshing && "refresh-icon-button-refreshing",
        iconClassName,
      )}
    />
  );
}
