'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OrbitLoader } from '@/components/ui/loading';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export function WorkflowSectionHeader({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

export function ValidationNotice({
  title = 'Validation error',
  message,
  className,
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100', className)} role="alert">
      <p className="font-medium text-red-200">{title}</p>
      <p className="mt-1 text-red-100/90">{message}</p>
    </div>
  );
}

export function PendingNotice({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <OrbitLoader label={label} />
      {hint ? <p className="-mt-1 text-center text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function RevisionRequestNotice({
  title,
  requestText,
  requestedAt,
  pending,
  warning,
}: {
  title: string;
  requestText?: string;
  requestedAt?: string;
  pending: boolean;
  warning?: string;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      pending ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/10'
    )}>
      <div className="space-y-3">
        {pending ? <OrbitLoader label={title} /> : <p className="text-sm font-medium text-amber-100">{title}</p>}
        <div className="space-y-2 text-sm">
          {requestedAt ? <p className="text-muted-foreground">Requested {new Date(requestedAt).toLocaleString()}</p> : null}
          {requestText ? (
            <div className="rounded-md border border-border/60 bg-background/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest requested changes</p>
              <p className="mt-2 whitespace-pre-wrap text-foreground">{requestText}</p>
            </div>
          ) : null}
          {warning ? <p className="text-amber-100">{warning}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function StaleArtifactNotice({
  updatedAt,
  label,
}: {
  updatedAt?: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-50">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-amber-50/80">
        {updatedAt
          ? `Showing the current on-disk version from ${new Date(updatedAt).toLocaleString()}. A newer revision has not been written yet.`
          : 'Showing the current on-disk version. A newer revision has not been written yet.'}
      </p>
    </div>
  );
}

export function AutoRefreshBanner({
  activeStages,
  refreshing,
}: {
  activeStages: string[];
  refreshing: boolean;
}) {
  if (activeStages.length === 0 && !refreshing) return null;

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {activeStages.length > 0 ? 'Auto-refresh is on while background jobs run.' : 'Refreshing workflow state…'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeStages.length > 0
              ? 'The dashboard is polling for new outputs so pending stages update automatically without a manual refresh.'
              : 'Checking for the latest workflow updates.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeStages.map((stage) => (
            <Badge key={stage} variant="success" className="capitalize">
              {stage}
            </Badge>
          ))}
          {refreshing ? <Badge variant="secondary">Refreshing…</Badge> : null}
        </div>
      </div>
    </Card>
  );
}

export function StageReviewControls({
  status,
  note,
  saving,
  pending,
  editing,
  subjectLabel,
  showEditButton = true,
  onStatusChange,
  onNoteChange,
  onApply,
  onToggleEdit,
}: {
  status: string;
  note: string;
  saving: boolean;
  pending?: boolean;
  editing: boolean;
  subjectLabel: string;
  showEditButton?: boolean;
  onStatusChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onApply: () => void;
  onToggleEdit: () => void;
}) {
  const cleanRerun = status === 'requested changes' && !note.trim();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={status} onChange={(e) => onStatusChange(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="needs review">Needs Review</option>
            <option value="requested changes">Requested Changes</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </Select>
        </div>
        <div className="flex-1 space-y-2">
          <Input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={status === 'requested changes' ? `Optional notes — leave blank to regenerate ${subjectLabel.toLowerCase()} cleanly` : 'Optional note'}
          />
          {status === 'requested changes' ? (
            <p className="text-xs text-muted-foreground">
              Leave notes empty to rerun {subjectLabel.toLowerCase()} from the current approved inputs, or add notes to request a targeted revision.
            </p>
          ) : null}
        </div>
        <Button onClick={onApply} disabled={saving}>
          {status === 'requested changes'
            ? cleanRerun
              ? `Regenerate ${subjectLabel.toLowerCase()}`
              : 'Request changes'
            : 'Apply status'}
        </Button>
        {showEditButton ? (
          <Button variant="outline" onClick={onToggleEdit}>
            {editing ? 'Cancel edit' : 'Edit'}
          </Button>
        ) : null}
      </div>
      {pending ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground">
          Waiting for the latest {status === 'requested changes' ? 'revision' : 'generation'} to land. This section will refresh automatically.
        </div>
      ) : null}
    </div>
  );
}
