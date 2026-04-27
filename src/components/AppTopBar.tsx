'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppShellChrome } from '@/components/app-shell-chrome';
import { buildDashboardBreadcrumbs } from '@/lib/dashboard-navigation';

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function AppTopBar() {
  const pathname = usePathname() || '/';
  const {
    hasShortFormSecondaryNav,
    shortFormDesktopOpen,
    shortFormMobileOpen,
    secondarySidebar,
    toggleMainSidebar,
    toggleShortFormSidebar,
    hasDesktopShortFormSidebar,
  } = useAppShellChrome();

  const breadcrumbs = useMemo(
    () => buildDashboardBreadcrumbs(pathname, { shortFormProjectLabel: secondarySidebar?.breadcrumbLabel }),
    [pathname, secondarySidebar?.breadcrumbLabel]
  );
  const shortFormNavOpen = hasDesktopShortFormSidebar ? shortFormDesktopOpen : shortFormMobileOpen;

  return (
    <header className="sticky top-0 z-30 flex h-[var(--app-shell-header-height)] items-center border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="flex h-full w-full items-center gap-2 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMainSidebar}
          className="-ml-1"
          aria-label="Toggle main navigation"
          title="Toggle main navigation"
        >
          <MenuIcon />
        </Button>

        {hasShortFormSecondaryNav ? (
          <>
            <Separator orientation="vertical" className="!h-4" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShortFormSidebar}
              aria-label={shortFormNavOpen ? 'Hide workflow sidebar' : 'Show workflow sidebar'}
              title={shortFormNavOpen ? 'Hide workflow sidebar' : 'Show workflow sidebar'}
            >
              <PanelIcon />
            </Button>
          </>
        ) : null}

        <Separator orientation="vertical" className="!h-4 shrink-0" />

        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          <Breadcrumb className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
            <BreadcrumbList className="h-full min-w-0 flex-nowrap items-center overflow-hidden">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <BreadcrumbItem
                    key={`${item.label}-${index}`}
                    className={item.truncate ? 'h-full min-w-0 max-w-full flex-1 basis-0 items-center' : 'h-full min-w-0 max-w-full shrink-0 items-center'}
                  >
                    {item.href && !isLast ? (
                      <BreadcrumbLink href={item.href} className="inline-flex h-full min-w-0 max-w-full flex-1 items-center truncate align-middle">
                        {item.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="inline-flex h-full min-w-0 max-w-full flex-1 items-center truncate align-middle">{item.label}</BreadcrumbPage>
                    )}
                    {!isLast ? <BreadcrumbSeparator className="shrink-0 items-center" /> : null}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </header>
  );
}
