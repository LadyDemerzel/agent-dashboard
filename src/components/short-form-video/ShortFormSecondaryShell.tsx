'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  AudioLines,
  Captions,
  Clapperboard,
  FileText,
  GalleryVerticalEnd,
  Image,
  Images,
  Layers,
  Lightbulb,
  ListMusic,
  MessageSquareText,
  Mic2,
  Music,
  Palette,
  Search,
  Type,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
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
import type {
  ShortFormSecondaryNavIcon,
  ShortFormSecondaryNavItem,
} from '@/lib/short-form-secondary-nav';
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
  prompts: MessageSquareText,
  audio: AudioLines,
  'sound-library': Layers,
  images: Palette,
  'settings-captions': Type,
  backgrounds: GalleryVerticalEnd,
  music: Music,
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
  const fallbackGroupLabel = title.toLowerCase().includes('settings') ? 'Settings' : 'WRITING';
  const groups = useMemo(() => groupNavItems(items, fallbackGroupLabel), [fallbackGroupLabel, items]);

  return (
    <Sidebar className="h-full border-r border-sidebar-border bg-sidebar">
      <SidebarHeader>
        <div className="w-full min-w-0">
          <p className="text-xs text-muted-foreground">Short-Form Video</p>
          <p className="max-w-full truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{title}</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={`${group.label}-${groupIndex}`}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
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
