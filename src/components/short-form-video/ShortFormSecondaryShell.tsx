'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Captions,
  Clapperboard,
  FileText,
  Image,
  Images,
  Lightbulb,
  ListMusic,
  Loader2,
  Mic2,
  MoreVertical,
  Search,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAppShellChrome, type AppShellSecondarySidebarConfig } from '@/components/app-shell-chrome';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from '@/components/ui/sidebar';
import type {
  ShortFormSecondaryNavIcon,
  ShortFormSecondaryNavItem,
} from '@/lib/short-form-secondary-nav';
import {
  getShortFormAutoRunStartedFromLabel,
  SHORT_FORM_AUTO_RUN_STEPS,
  type ShortFormAutoRunState,
  type ShortFormAutoRunStepId,
} from '@/lib/short-form-auto-run';
import { cn } from '@/lib/utils';

const NAV_ICON_CLASS = 'mt-0.5 h-4 w-4 shrink-0';

const SHORT_FORM_NAV_ICONS: Record<ShortFormSecondaryNavIcon, LucideIcon> = {
  topic: Lightbulb,
  hook: WandSparkles,
  research: Search,
  'text-script': FileText,
  narration: Mic2,
  captions: Captions,
  'plan-visuals': Image,
  'generate-visuals': Images,
  'plan-sound-design': ListMusic,
  'generate-sound-design': Volume2,
  'final-video': Clapperboard,
};

function NavItemCard({ item }: { item: ShortFormSecondaryNavItem }) {
  const Icon = item.icon ? SHORT_FORM_NAV_ICONS[item.icon] : null;

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5">
      {Icon ? <Icon aria-hidden="true" className={NAV_ICON_CLASS} /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{item.label}</span>
            {item.dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
          </div>
          {item.status ? <StatusBadge status={item.status} compact className="shrink-0" /> : null}
        </div>
      </div>
    </div>
  );
}

function NavChildItemCard({ item }: { item: ShortFormSecondaryNavItem }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm">{item.label}</span>
        {item.dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
      </div>
      {item.status ? <StatusBadge status={item.status} compact className="shrink-0" /> : null}
    </div>
  );
}

function groupNavItems(items: ShortFormSecondaryNavItem[], fallbackLabel: string) {
  return items.reduce<Array<{ label: string; items: ShortFormSecondaryNavItem[] }>>((groups, item) => {
    const label = item.group || fallbackLabel;
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.label === label) {
      previousGroup.items.push(item);
      return groups;
    }

    groups.push({ label, items: [item] });
    return groups;
  }, []);
}

function autoRunStatusForStep(autoRun: ShortFormAutoRunState, stepId: ShortFormAutoRunStepId) {
  if (autoRun.failedStep === stepId) return 'failed';
  if (autoRun.currentStep === stepId && autoRun.status === 'active') return 'working';
  if (autoRun.completedSteps.includes(stepId)) return 'completed';
  if (autoRun.skippedSteps.includes(stepId)) return 'skipped';
  if (autoRun.waitingSteps.includes(stepId)) return 'queued by auto-run';
  return 'draft';
}

function AutoRunSidebarCallout({
  projectId,
  autoRun,
}: {
  projectId?: string;
  autoRun?: ShortFormAutoRunState;
}) {
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!autoRun) return null;

  const calloutStatus = autoRun.status === 'active' ? 'working' : autoRun.status;
  const calloutTitle =
    autoRun.status === 'active'
      ? 'Auto-generation running'
      : autoRun.status === 'completed'
        ? 'Auto-generation completed'
        : autoRun.status === 'failed'
          ? 'Auto-generation failed'
          : 'Auto-generation stopped';

  return (
    <>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-left text-sm text-sidebar-foreground transition hover:bg-blue-500/15"
        >
          {autoRun.status === 'active' ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{calloutTitle}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {autoRun.currentStep
                ? SHORT_FORM_AUTO_RUN_STEPS.find((step) => step.id === autoRun.currentStep)?.label
                : autoRun.status === 'completed'
                  ? `${autoRun.completedSteps.length} steps ran`
                  : autoRun.status === 'failed'
                    ? autoRun.error || 'Stopped before completion'
                    : 'Waiting for the next step'}
            </span>
          </span>
          <StatusBadge status={calloutStatus} compact />
        </button>
      </div>
      <DialogOverlay open={open} onClick={() => setOpen(false)}>
        <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Auto-generation</DialogTitle>
                <DialogDescription>
                  Started from {getShortFormAutoRunStartedFromLabel(autoRun.startedFrom)}
                </DialogDescription>
              </div>
              <StatusBadge status={calloutStatus} />
            </div>
          </DialogHeader>
          <div className="space-y-2">
            {SHORT_FORM_AUTO_RUN_STEPS.map((step) => {
              const status = autoRunStatusForStep(autoRun, step.id);
              return (
                <div
                  key={step.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2"
                >
                  <span className={cn('text-sm', status === 'skipped' && 'text-muted-foreground line-through')}>
                    {step.label}
                  </span>
                  <StatusBadge status={status} compact />
                </div>
              );
            })}
          </div>
          {autoRun.error ? (
            <p className="mt-3 whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-4 text-base font-semibold leading-relaxed text-destructive">
              {autoRun.error}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            {autoRun.status === 'active' && projectId ? (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (stopping) return;
                  setStopping(true);
                  setError(null);
                  try {
                    const response = await fetch(`/api/short-form-videos/${projectId}/auto-run`, {
                      method: 'DELETE',
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok || payload?.success === false) {
                      throw new Error(payload?.error || 'Failed to stop auto-generation');
                    }
                    setOpen(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to stop auto-generation');
                  } finally {
                    setStopping(false);
                  }
                }}
                disabled={stopping}
              >
                {stopping ? 'Stopping…' : 'Stop auto-generation'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogOverlay>
    </>
  );
}

function ProjectSidebarActions({
  projectId,
  title,
  onProjectRenamed,
}: {
  projectId?: string;
  title: string;
  onProjectRenamed?: (nextName: string) => void;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);
  const [renaming, setRenaming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!renameOpen) setRenameDraft(title);
  }, [renameOpen, title]);

  if (!projectId) return null;

  async function renameProject(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    const nextName = renameDraft.trim();
    if (!nextName) {
      setError('Video name cannot be empty');
      return;
    }

    setRenaming(true);
    setError(null);
    try {
      const response = await fetch(`/api/short-form-videos/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Failed to rename video');
      }
      onProjectRenamed?.(nextName);
      setRenameOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename video');
    } finally {
      setRenaming(false);
    }
  }

  async function duplicateProject() {
    if (!projectId || duplicating) return;
    setDuplicating(true);
    setError(null);
    try {
      const response = await fetch(`/api/short-form-videos/${projectId}/duplicate`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false || !payload?.data?.id) {
        throw new Error(payload?.error || 'Failed to duplicate video');
      }
      router.push(`/short-form-video/${payload.data.id}/topic`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate video');
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Open actions for ${title}`}
            aria-busy={duplicating}
            disabled={duplicating}
            className="h-8 w-8 shrink-0 rounded-full bg-transparent p-0 shadow-none hover:border hover:border-border hover:bg-accent focus-visible:ring-1"
          >
            {duplicating ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical aria-hidden="true" className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            disabled={duplicating}
            onSelect={() => {
              setError(null);
              setRenameDraft(title);
              setRenameOpen(true);
            }}
          >
            Rename video
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={duplicating}
            onSelect={() => void duplicateProject()}
          >
            {duplicating ? 'Duplicating…' : 'Duplicate video'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogOverlay
        open={renameOpen || Boolean(error && !duplicating)}
        onClick={() => {
          if (renaming) return;
          if (renameOpen) {
            setRenameOpen(false);
          } else {
            setError(null);
          }
        }}
      >
        <DialogContent size="md" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{renameOpen ? 'Rename video' : 'Video action failed'}</DialogTitle>
            <DialogDescription>
              {renameOpen
                ? 'This name is used in the workflow navigation and video list.'
                : 'The requested action did not complete.'}
            </DialogDescription>
          </DialogHeader>
          {renameOpen ? (
            <form onSubmit={renameProject} className="space-y-4">
              <Input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                placeholder="Video name"
                autoFocus
                disabled={renaming}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="submit" disabled={renaming || !renameDraft.trim()}>
                  {renaming ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameOpen(false)}
                  disabled={renaming}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setError(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </>
  );
}

function SecondarySidebarBody({
  title,
  items,
  projectId,
  autoRun,
  onProjectRenamed,
  onNavigate,
}: {
  title: string;
  items: ShortFormSecondaryNavItem[];
  projectId?: string;
  autoRun?: ShortFormAutoRunState;
  onProjectRenamed?: (nextName: string) => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname() || '/';
  const fallbackGroupLabel = title.toLowerCase().includes('settings') ? 'Settings' : 'WRITING';
  const groups = useMemo(() => groupNavItems(items, fallbackGroupLabel), [fallbackGroupLabel, items]);

  return (
    <Sidebar className="h-full border-r border-sidebar-border bg-sidebar">
      <SidebarHeader>
        <div className="flex w-full min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Short-Form Video</p>
            <p className="max-w-full truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{title}</p>
          </div>
          <ProjectSidebarActions projectId={projectId} title={title} onProjectRenamed={onProjectRenamed} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <AutoRunSidebarCallout projectId={projectId} autoRun={autoRun} />
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={`${group.label}-${groupIndex}`}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.href || Boolean(item.children?.some((child) => pathname === child.href));
                  const itemContent = <NavItemCard item={item} />;

                  if (item.locked) {
                    return (
                      <SidebarMenuItem key={item.href}>
                        <div className="flex min-h-11 w-full items-center rounded-xl px-3 py-3 text-left text-muted-foreground opacity-65">
                          {itemContent}
                        </div>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuLink href={item.href} prefetch={false} isActive={active} onClick={onNavigate} className="h-auto items-center py-3">
                        {itemContent}
                      </SidebarMenuLink>
                      {item.children?.length ? (
                        <div className="ml-7 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                          {item.children.map((child) => {
                            const childActive = pathname === child.href;
                            if (child.locked) {
                              return (
                                <div
                                  key={child.href}
                                  className="flex min-h-9 w-full items-center rounded-lg px-2.5 py-2 text-left text-muted-foreground opacity-65"
                                >
                                  <NavChildItemCard item={child} />
                                </div>
                              );
                            }
                            return (
                              <SidebarMenuLink
                                key={child.href}
                                href={child.href}
                                prefetch={false}
                                isActive={childActive}
                                onClick={onNavigate}
                                className="h-auto items-center rounded-lg px-2.5 py-2"
                              >
                                <NavChildItemCard item={child} />
                              </SidebarMenuLink>
                            );
                          })}
                        </div>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function ShortFormSecondarySidebar({
  sidebar,
}: {
  sidebar: AppShellSecondarySidebarConfig;
}) {
  const { shortFormDesktopOpen, shortFormMobileOpen, closeShortFormSidebar } = useAppShellChrome();

  return (
    <>
      {shortFormMobileOpen ? <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={closeShortFormSidebar} /> : null}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[17rem] transition-transform duration-200 md:hidden',
          shortFormMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SecondarySidebarBody title={sidebar.title} items={sidebar.items} projectId={sidebar.projectId} autoRun={sidebar.autoRun} onProjectRenamed={sidebar.onProjectRenamed} onNavigate={closeShortFormSidebar} />
      </div>

      <aside
        className={cn(
          'relative hidden shrink-0 overflow-hidden transition-[width] duration-200 md:block',
          shortFormDesktopOpen ? 'border-r border-sidebar-border bg-sidebar' : 'border-r-0 bg-transparent pointer-events-none'
        )}
        style={{ width: 'var(--short-form-secondary-nav-width)' }}
      >
        <div className={cn('sticky top-0 h-screen overflow-hidden transition-opacity duration-200', !shortFormDesktopOpen && 'opacity-0')}>
          <SecondarySidebarBody title={sidebar.title} items={sidebar.items} projectId={sidebar.projectId} autoRun={sidebar.autoRun} onProjectRenamed={sidebar.onProjectRenamed} onNavigate={() => undefined} />
        </div>
      </aside>
    </>
  );
}

export function ShortFormSecondaryShell({
  title,
  items,
  breadcrumbLabel,
  projectId,
  autoRun,
  onProjectRenamed,
  children,
}: {
  title: string;
  items: ShortFormSecondaryNavItem[];
  breadcrumbLabel?: string;
  projectId?: string;
  autoRun?: ShortFormAutoRunState;
  onProjectRenamed?: (nextName: string) => void;
  children: ReactNode;
}) {
  const { setSecondarySidebar, clearSecondarySidebar } = useAppShellChrome();

  const sidebarConfig = useMemo<AppShellSecondarySidebarConfig>(
    () => ({ title, items, breadcrumbLabel, projectId, autoRun, onProjectRenamed }),
    [autoRun, breadcrumbLabel, items, onProjectRenamed, projectId, title]
  );

  useEffect(() => {
    setSecondarySidebar(sidebarConfig);
  }, [setSecondarySidebar, sidebarConfig]);

  useEffect(() => () => clearSecondarySidebar(), [clearSecondarySidebar]);

  return <div className="min-h-[calc(100vh-var(--app-shell-header-height))] min-w-0">{children}</div>;
}
