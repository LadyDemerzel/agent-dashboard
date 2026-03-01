'use client';

import type { PhaseDefinition, PhaseStatus } from '@/lib/youtube-workflow';

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
  ready: 'border-zinc-700 bg-zinc-900',
  working: 'border-zinc-600 bg-zinc-900',
  locked: 'border-zinc-800 bg-zinc-950 opacity-60',
};

const BUTTON_CLASSES: Record<PhaseStatus, string> = {
  ready: 'bg-white text-zinc-900 hover:bg-zinc-100',
  complete: 'bg-emerald-900 text-emerald-400 cursor-not-allowed',
  locked: 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
  working: 'bg-zinc-700 text-zinc-300',
};

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
    <div className={`p-4 rounded-xl text-center border ${CARD_CLASSES[status]}`}>
      <div className="text-2xl mb-2">{phase.icon}</div>
      <div className="font-medium text-sm text-white">{phase.label}</div>
      <div className="text-xs text-zinc-500">{phase.agent}</div>
      <button
        onClick={onTrigger}
        disabled={disabled}
        className={`mt-3 px-3 py-1.5 text-xs rounded font-medium w-full ${BUTTON_CLASSES[status]}`}
      >
        {getButtonLabel(status, triggering)}
      </button>
    </div>
  );
}
