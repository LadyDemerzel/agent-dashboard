"use client";

import { PencilLine } from "lucide-react";
import {
  IconTooltipButton,
  type IconTooltipButtonProps,
} from "@/components/IconTooltipButton";

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
    />
  );
}
