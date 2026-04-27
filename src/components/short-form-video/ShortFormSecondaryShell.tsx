'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
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
import type { ShortFormSecondaryNavItem } from '@/lib/short-form-secondary-nav';
import { cn } from '@/lib/utils';

function NavItemCard({ item }: { item: ShortFormSecondaryNavItem }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
        </div>
        {item.status ? <StatusBadge status={item.status} compact className="shrink-0" /> : null}
      </div>
    </div>
  );
}

function SecondarySidebarBody({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: ShortFormSecondaryNavItem[];
  onNavigate: () => void;
}) {
  const pathname = usePathname() || '/';
  const groupLabel = title.toLowerCase().includes('settings') ? 'Settings' : 'Workflow';

  return (
    <Sidebar className="h-full border-r border-sidebar-border bg-sidebar">
      <SidebarHeader>
        <div className="w-full min-w-0">
          <p className="text-xs text-muted-foreground">Short-Form Video</p>
          <p className="max-w-full truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{title}</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.href;
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
                    <SidebarMenuLink href={item.href} isActive={active} onClick={onNavigate} className="h-auto items-center py-3">
                      {itemContent}
                    </SidebarMenuLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
      {shortFormMobileOpen ? <div className="fixed inset-0 top-[var(--app-shell-header-height)] z-30 bg-black/50 md:hidden" onClick={closeShortFormSidebar} /> : null}

      <div
        className={cn(
          'fixed bottom-0 left-0 top-[var(--app-shell-header-height)] z-30 w-[17rem] min-h-[calc(100dvh-var(--app-shell-header-height))] transition-transform duration-200 md:hidden',
          shortFormMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SecondarySidebarBody title={sidebar.title} items={sidebar.items} onNavigate={closeShortFormSidebar} />
      </div>

      <aside
        className={cn(
          'relative hidden shrink-0 overflow-hidden transition-[width] duration-200 md:block',
          shortFormDesktopOpen ? 'border-r border-sidebar-border bg-sidebar' : 'border-r-0 bg-transparent pointer-events-none'
        )}
        style={{ width: 'var(--short-form-secondary-nav-width)' }}
      >
        <div className={cn('sticky top-0 h-screen overflow-hidden transition-opacity duration-200', !shortFormDesktopOpen && 'opacity-0')}>
          <SecondarySidebarBody title={sidebar.title} items={sidebar.items} onNavigate={() => undefined} />
        </div>
      </aside>
    </>
  );
}

export function ShortFormSecondaryShell({
  title,
  items,
  breadcrumbLabel,
  children,
}: {
  title: string;
  items: ShortFormSecondaryNavItem[];
  breadcrumbLabel?: string;
  children: ReactNode;
}) {
  const { setSecondarySidebar, clearSecondarySidebar } = useAppShellChrome();

  const sidebarConfig = useMemo<AppShellSecondarySidebarConfig>(
    () => ({ title, items, breadcrumbLabel }),
    [breadcrumbLabel, items, title]
  );

  useEffect(() => {
    setSecondarySidebar(sidebarConfig);
  }, [setSecondarySidebar, sidebarConfig]);

  useEffect(() => () => clearSecondarySidebar(), [clearSecondarySidebar]);

  return <div className="min-h-[calc(100vh-var(--app-shell-header-height))] min-w-0">{children}</div>;
}
