'use client';

import type { PhaseDefinition, PhaseStatus } from '@/lib/youtube-workflow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface YouTubeWorkflowStageCardProps {
  phase: PhaseDefinition;
  status: PhaseStatus;
  triggering: boolean;
  onTrigger: () => void;
  /** True when any phase is currently being triggered */
  anyTriggering: boolean;
}

const CARD_CLASSES: Record<PhaseStatus, string> = {
  complete: 'border-emerald-800 bg-emerald-950',
  ready: 'border-border bg-card',
  working: 'border-border bg-card',
  locked: 'border-border bg-background opacity-60',
};

function getButtonVariant(status: PhaseStatus): "default" | "success" | "secondary" | "ghost" {
  switch (status) {
    case 'ready': return 'default';
    case 'complete': return 'success';
    case 'locked': return 'ghost';
    case 'working': return 'secondary';
  }
}

function getButtonLabel(status: PhaseStatus, triggering: boolean): string {
  if (triggering) return 'Starting...';
  switch (status) {
    case 'complete': return '✓ Complete';
    case 'ready': return 'Start';
    case 'locked': return 'Locked';
    case 'working': return 'In Progress';
  }
}

export function YouTubeWorkflowStageCard({
  phase,
  status,
  triggering,
  onTrigger,
  anyTriggering,
}: YouTubeWorkflowStageCardProps) {
  const disabled = anyTriggering || status === 'locked' || status === 'complete';

  return (
    <Card className={`p-4 text-center ${CARD_CLASSES[status]}`}>
      <div className="text-2xl mb-2">{phase.icon}</div>
      <div className="font-medium text-sm text-foreground">{phase.label}</div>
      <div className="text-xs text-muted-foreground">{phase.agent}</div>
      <Button
        onClick={onTrigger}
        disabled={disabled}
        variant={getButtonVariant(status)}
        size="sm"
        className="mt-3 w-full"
      >
        {getButtonLabel(status, triggering)}
      </Button>
    </Card>
  );
}
