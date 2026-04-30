"use client";

import { PencilLine } from "lucide-react";
import {
  IconTooltipButton,
  type IconTooltipButtonProps,
} from "@/components/IconTooltipButton";
import { cn } from "@/lib/utils";

export interface EditIconButtonProps
  extends Omit<IconTooltipButtonProps, "icon" | "tooltip" | "label"> {
  editing?: boolean;
  tooltip?: string;
  editingTooltip?: string;
  label?: string;
  editingLabel?: string;
}

export function EditIconButton({
  editing = false,
  tooltip = "Edit",
  editingTooltip = "Cancel edit",
  label,
  editingLabel,
  className,
  ...props
}: EditIconButtonProps) {
  const tooltipText = editing ? editingTooltip : tooltip;
  const labelText = editing ? editingLabel || editingTooltip : label || tooltip;

  return (
    <IconTooltipButton
      {...props}
      icon={PencilLine}
      tooltip={tooltipText}
      label={labelText}
      aria-pressed={editing || undefined}
      className={cn("cursor-pointer disabled:cursor-not-allowed", className)}
    />
  );
}
