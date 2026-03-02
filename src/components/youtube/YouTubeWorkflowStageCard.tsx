'use client';

import type { PhaseDefinition, PhaseStatus } from '@/lib/youtube-workflow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const PHASE_ICONS: Record<string, React.ReactNode> = {
  Search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  Script: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  ),
  Images: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  Audio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
};

interface YouTubeWorkflowStageCardProps {
  phase: PhaseDefinition;
  status: PhaseStatus;
  triggering: boolean;
  onTrigger: () => void;
  /** True when any phase is currently being triggered */
  anyTriggering: boolean;
}

const CARD_CLASSES: Record<PhaseStatus, string> = {
  complete: 'border-emerald-500/20 bg-emerald-500/5',
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
    case 'complete': return 'Complete';
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
      <div className="flex justify-center mb-2 text-muted-foreground">{PHASE_ICONS[phase.icon] || <span className="text-sm">{phase.icon}</span>}</div>
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
