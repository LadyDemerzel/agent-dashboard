'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppShellChrome } from '@/components/app-shell-chrome';
import {
  Sidebar as SidebarFrame,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  settingsHref?: string;
  settingsLabel?: string;
};

const iconClass = 'h-4 w-4';

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      {
        href: '/',
        label: 'Dashboard',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        href: '/deliverables',
        label: 'Deliverables',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <path d="M21 8v13H3V8" />
            <path d="M1 8h22" />
            <path d="M10 12h4" />
            <path d="M10 16h4" />
            <path d="M8 8V4h8v4" />
          </svg>
        ),
      },
      {
        href: '/research',
        label: 'Research',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        ),
      },
      {
        href: '/x-posts',
        label: 'X Posts',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        ),
      },
      {
        href: '/youtube-videos',
        label: 'YouTube Videos',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <path d="m10 9 5 3-5 3V9Z" />
          </svg>
        ),
      },
      {
        href: '/short-form-video',
        label: 'Short-Form Video',
        settingsHref: '/short-form-video/settings/prompts',
        settingsLabel: 'Open short-form video settings',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="m10 9 5 3-5 3V9Z" />
            <path d="M7 4v16" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/timeline',
        label: 'Timeline',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6l4 2" />
          </svg>
        ),
      },
      {
        href: '/agents',
        label: 'Agents',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass}>
            <rect x="4" y="7" width="16" height="12" rx="2" />
            <path d="M9 3h6" />
            <path d="M12 7V3" />
            <circle cx="9" cy="13" r="1" />
            <circle cx="15" cy="13" r="1" />
            <path d="M9 16h6" />
          </svg>
        ),
      },
    ],
  },
];

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.96 4.6a1.7 1.7 0 0 0 1.04-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.96c.34.14.7.21 1.07.21H21a2 2 0 1 1 0 4h-.09c-.37 0-.73.07-1.07.21Z" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '/';
  const { mainCollapsed, mainMobileOpen, closeMainSidebar } = useAppShellChrome();

  return (
    <>
      {mainMobileOpen ? <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={closeMainSidebar} /> : null}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[17rem] transition-transform duration-200 md:w-[var(--app-shell-sidebar-width)]',
          mainMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <SidebarFrame className="shadow-2xl shadow-black/30 md:shadow-none">
          <SidebarHeader className={cn(mainCollapsed ? 'md:hidden' : 'md:px-3')}>
            <div className="px-3 py-2">
              <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">Agent Dashboard</p>
            </div>
          </SidebarHeader>

          <SidebarContent className={cn(mainCollapsed && 'md:px-2')}>
            {NAV_GROUPS.map((group, groupIndex) => (
              <SidebarGroup key={group.label}>
                {mainCollapsed ? (
                  groupIndex > 0 ? <div className="mx-2 border-t border-sidebar-border/80" aria-hidden="true" /> : null
                ) : (
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                      const settingsActive = Boolean(item.settingsHref && pathname.startsWith(item.settingsHref));

                      return (
                        <SidebarMenuItem key={item.href}>
                          {mainCollapsed ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <SidebarMenuLink
                                href={item.href}
                                compact
                                isActive={active}
                                onClick={closeMainSidebar}
                                aria-label={item.label}
                                title={item.label}
                              >
                                <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span>
                              </SidebarMenuLink>
                              {item.settingsHref ? (
                                <SidebarMenuLink
                                  href={item.settingsHref}
                                  compact
                                  isActive={settingsActive}
                                  onClick={closeMainSidebar}
                                  aria-label={item.settingsLabel || `Open ${item.label} settings`}
                                  title={item.settingsLabel || `Open ${item.label} settings`}
                                  className="h-8 w-8 rounded-lg"
                                >
                                  <SettingsIcon />
                                </SidebarMenuLink>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <SidebarMenuLink href={item.href} isActive={active} onClick={closeMainSidebar} className="min-w-0 flex-1">
                                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
                                <span className="truncate">{item.label}</span>
                              </SidebarMenuLink>
                              {item.settingsHref ? (
                                <Link
                                  href={item.settingsHref}
                                  onClick={closeMainSidebar}
                                  aria-label={item.settingsLabel || `Open ${item.label} settings`}
                                  title={item.settingsLabel || `Open ${item.label} settings`}
                                  className={cn(
                                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground',
                                    settingsActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                                  )}
                                >
                                  <SettingsIcon />
                                </Link>
                              ) : null}
                            </div>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className={cn(mainCollapsed && 'md:px-2')}>
            <div className={cn('flex items-center gap-2 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 px-3 py-2 text-xs text-muted-foreground', mainCollapsed && 'md:justify-center md:px-0')}>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className={cn(mainCollapsed && 'md:hidden')}>System active</span>
            </div>
          </SidebarFooter>
        </SidebarFrame>
      </div>
    </>
  );
}
