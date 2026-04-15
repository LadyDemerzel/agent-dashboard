'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { SyntaxHighlightedCode } from '@/components/short-form-video/SyntaxHighlightedCode';
import { ValidationNotice } from '@/components/short-form-video/WorkflowShared';

export interface PipelineDetail {
  id: string;
  label: string;
  format: 'text' | 'json';
  content: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  summary?: string;
  updatedAt?: string;
  progressPercent?: number;
  progressLabel?: string;
  details?: PipelineDetail[];
}

export interface PipelinePanelProps {
  title: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  warning?: string;
  steps: PipelineStep[];
  metadata?: ReactNode;
  className?: string;
}

function DebugContent({ content, format }: { content: string; format: PipelineDetail['format'] }) {
  if (!content.trim()) {
    return <p className="text-xs text-muted-foreground">No data captured.</p>;
  }

  return (
    <SyntaxHighlightedCode
      content={content}
      language={format === 'json' ? 'json' : 'text'}
      className="p-3 text-[11px] leading-5"
    />
  );
}

function statusForPipeline(status: PipelinePanelProps['status']) {
  if (status === 'running') return 'working';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function statusForStep(status: PipelineStep['status']) {
  if (status === 'active') return 'working';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3.5 6 4.5 4 4.5-4" />
    </svg>
  );
}

function PipelineStepCard({
  step,
  index,
  expanded,
  onToggle,
}: {
  step: PipelineStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails = Boolean(step.details && step.details.length > 0);

  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Step {index + 1}</span>
            <h4 className="truncate font-medium text-foreground">{step.label}</h4>
            {typeof step.progressPercent === 'number' ? (
              <span className="text-xs text-muted-foreground">{Math.round(step.progressPercent)}%</span>
            ) : null}
            {step.updatedAt ? (
              <span className="text-xs text-muted-foreground">Updated {new Date(step.updatedAt).toLocaleString()}</span>
            ) : null}
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <StatusBadge status={statusForStep(step.status)} compact />
          {hasDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggle}
              aria-label={expanded ? `Collapse ${step.label} details` : `Expand ${step.label} details`}
              aria-expanded={expanded}
            >
              <ExpandIcon expanded={expanded} />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
          {step.summary ? <p className="text-sm text-muted-foreground">{step.summary}</p> : null}
          {typeof step.progressPercent === 'number' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{step.progressLabel || 'In progress'}</span>
                <span>{Math.round(step.progressPercent)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/70">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, step.progressPercent))}%` }}
                />
              </div>
            </div>
          ) : null}
          {step.details?.map((detail) => (
            <div key={detail.id} className="space-y-2 rounded-lg border border-border/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detail.label}</p>
              <DebugContent content={detail.content} format={detail.format} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PipelinePanel({
  title,
  description,
  status,
  warning,
  steps,
  metadata,
  className,
}: PipelinePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  if (steps.length === 0) return null;

  return (
    <div className={cn('space-y-4 rounded-lg border border-border bg-background/60 p-4', className)}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <StatusBadge status={statusForPipeline(status)} />
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {metadata ? <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">{metadata}</div> : null}
        {warning ? <ValidationNotice title={`${title} warning`} message={warning} className="mt-3" /> : null}
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <PipelineStepCard
            key={step.id}
            step={step}
            index={index}
            expanded={expandedSteps[step.id] ?? false}
            onToggle={() => setExpandedSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
          />
        ))}
      </div>
    </div>
  );
}
