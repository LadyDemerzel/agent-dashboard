import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info';

const WORKING_STATUSES = new Set(['working', 'running', 'in-progress', 'active']);

const STATUS_CONFIG: Record<string, { variant: StatusVariant; dot: string; label?: string }> = {
  idle: { variant: 'default', dot: 'bg-zinc-500' },
  draft: { variant: 'default', dot: 'bg-zinc-500' },
  ready: { variant: 'secondary', dot: 'bg-zinc-400' },
  pending: { variant: 'warning', dot: 'bg-amber-500' },
  review: { variant: 'warning', dot: 'bg-amber-500' },
  'needs review': { variant: 'warning', dot: 'bg-amber-500' },
  working: { variant: 'info', dot: 'bg-blue-500', label: 'Working' },
  running: { variant: 'info', dot: 'bg-blue-500', label: 'Working' },
  active: { variant: 'info', dot: 'bg-blue-500', label: 'Working' },
  'in-progress': { variant: 'info', dot: 'bg-blue-500', label: 'Working' },
  approved: { variant: 'success', dot: 'bg-emerald-500' },
  completed: { variant: 'success', dot: 'bg-emerald-500' },
  skipped: { variant: 'warning', dot: 'bg-amber-500' },
  published: { variant: 'info', dot: 'bg-blue-500' },
  'requested changes': { variant: 'destructive', dot: 'bg-red-500' },
  blocked: { variant: 'destructive', dot: 'bg-red-500' },
  failed: { variant: 'destructive', dot: 'bg-red-500' },
};

export function StatusBadge({
  status,
  compact = false,
  className,
}: {
  status: string;
  compact?: boolean;
  className?: string;
}) {
  const safeStatus = status || 'draft';
  const config = STATUS_CONFIG[safeStatus] || STATUS_CONFIG.idle;
  const label = config.label || safeStatus.replace(/\b\w/g, (c) => c.toUpperCase());
  const isWorking = WORKING_STATUSES.has(safeStatus);

  return (
    <Badge
      variant={config.variant}
      className={cn(compact && 'gap-1 px-2 py-0.5 text-[10px] leading-4', className)}
    >
      {isWorking ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block shrink-0 rounded-full border border-blue-400/35 border-t-blue-400 border-r-cyan-300 animate-spin shadow-[0_0_0_1px_rgba(59,130,246,0.08)]',
            compact ? 'h-3 w-3 border-[1.5px]' : 'h-3.5 w-3.5 border-2'
          )}
        />
      ) : (
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      )}
      {label}
    </Badge>
  );
}
