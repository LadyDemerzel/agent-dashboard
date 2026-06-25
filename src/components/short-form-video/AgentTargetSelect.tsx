"use client";

import { Bot, BrainCircuit, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  SHORT_FORM_AGENT_TARGET_OPTIONS,
  type ShortFormAgentTargetId,
} from "@/lib/short-form-agent-target-types";
import { cn } from "@/lib/utils";

const AGENT_TARGET_ICON: Record<ShortFormAgentTargetId, typeof Bot> = {
  "openclaw-scribe": Bot,
  "openclaw-oracle": BrainCircuit,
  "claude-code": Sparkles,
};

export function getAgentTargetLabel(target?: ShortFormAgentTargetId) {
  return SHORT_FORM_AGENT_TARGET_OPTIONS.find((option) => option.id === target)?.label || "Default agent";
}

export function AgentTargetSelect({
  value,
  onChange,
  disabled,
  label = "Agent",
  description,
  allowGlobalDefault = false,
  globalDefault,
  className,
}: {
  value?: ShortFormAgentTargetId;
  onChange: (value: ShortFormAgentTargetId | undefined) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  allowGlobalDefault?: boolean;
  globalDefault?: ShortFormAgentTargetId;
  className?: string;
}) {
  const selectedTarget = value || globalDefault;
  const selectedOption = SHORT_FORM_AGENT_TARGET_OPTIONS.find((option) => option.id === selectedTarget);
  const Icon = selectedTarget ? AGENT_TARGET_ICON[selectedTarget] : Bot;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {allowGlobalDefault && !value && globalDefault ? (
          <Badge variant="secondary">Global default</Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={value || ""}
          onChange={(event) =>
            onChange(event.target.value ? event.target.value as ShortFormAgentTargetId : undefined)
          }
          disabled={disabled}
          className="max-w-xs"
        >
          {allowGlobalDefault ? (
            <option value="">
              Use global default{globalDefault ? ` (${getAgentTargetLabel(globalDefault)})` : ""}
            </option>
          ) : null}
          {SHORT_FORM_AGENT_TARGET_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
        {selectedOption ? (
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{selectedOption.description}</span>
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

