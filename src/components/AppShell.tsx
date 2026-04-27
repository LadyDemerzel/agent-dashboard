'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppTopBar } from '@/components/AppTopBar';
import { Sidebar } from '@/components/Sidebar';
import { InstantNavigationLoader } from '@/components/InstantNavigationLoader';
import { AppShellChromeContext, type AppShellSecondarySidebarConfig } from '@/components/app-shell-chrome';
import { ShortFormSecondarySidebar } from '@/components/short-form-video/ShortFormSecondaryShell';
import {
  routeHasShortFormSecondaryNav,
  SHORT_FORM_SECONDARY_NAV_WIDTH,
} from '@/lib/short-form-secondary-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [manualOverride, setManualOverride] = useState<{ key: string; collapsed: boolean } | null>(null);
  const [mainMobileOpen, setMainMobileOpen] = useState(false);
  const [shortFormDesktopOpen, setShortFormDesktopOpen] = useState(true);
  const [shortFormMobileOpen, setShortFormMobileOpen] = useState(false);
  const [secondarySidebar, setSecondarySidebarState] = useState<AppShellSecondarySidebarConfig | null>(null);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const hasShortFormSecondaryNav = routeHasShortFormSecondaryNav(pathname);
  const isDesktop = Boolean(viewportWidth && viewportWidth >= 768);
  const hasDesktopShortFormSidebar = isDesktop;

  const shouldDefaultCompact = useMemo(
    () => hasShortFormSecondaryNav,
    [hasShortFormSecondaryNav]
  );

  const routeModeKey = hasShortFormSecondaryNav ? 'secondary-nav' : 'default-nav';
  const mainCollapsed = isDesktop
    ? (manualOverride?.key === routeModeKey ? manualOverride.collapsed : shouldDefaultCompact)
    : false;
  const activeSecondarySidebar = hasShortFormSecondaryNav ? secondarySidebar : null;
  const activeShortFormMobileOpen = hasShortFormSecondaryNav ? shortFormMobileOpen : false;

  const setSecondarySidebar = useCallback((sidebar: AppShellSecondarySidebarConfig | null) => {
    setSecondarySidebarState(sidebar);
  }, []);

  const clearSecondarySidebar = useCallback(() => {
    setSecondarySidebarState(null);
  }, []);

  const toggleMainSidebar = () => {
    if (isDesktop) {
      setManualOverride({ key: routeModeKey, collapsed: !mainCollapsed });
      return;
    }
    setShortFormMobileOpen(false);
    setMainMobileOpen((current) => !current);
  };

  const toggleShortFormSidebar = () => {
    if (!hasShortFormSecondaryNav) return;
    if (hasDesktopShortFormSidebar) {
      setShortFormDesktopOpen((current) => !current);
      return;
    }
    setMainMobileOpen(false);
    setShortFormMobileOpen((current) => !current);
  };

  const contextValue = {
    hasShortFormSecondaryNav,
    isDesktop,
    hasDesktopShortFormSidebar,
    mainCollapsed,
    mainMobileOpen,
    shortFormDesktopOpen,
    shortFormMobileOpen: activeShortFormMobileOpen,
    secondarySidebar: activeSecondarySidebar,
    setSecondarySidebar,
    clearSecondarySidebar,
    toggleMainSidebar,
    closeMainSidebar: () => setMainMobileOpen(false),
    toggleShortFormSidebar,
    closeShortFormSidebar: () => setShortFormMobileOpen(false),
  };

  return (
    <AppShellChromeContext.Provider value={contextValue}>
      <div
        className="h-screen overflow-hidden"
        style={{
          ['--app-shell-header-height' as string]: '4rem',
          ['--app-shell-sidebar-width' as string]: isDesktop ? (mainCollapsed ? '4.75rem' : '15rem') : '0rem',
          ['--short-form-secondary-nav-width' as string]: hasShortFormSecondaryNav && hasDesktopShortFormSidebar && shortFormDesktopOpen ? SHORT_FORM_SECONDARY_NAV_WIDTH : '0rem',
        }}
      >
        <Sidebar />
        <div className="relative flex h-full min-h-0 md:ml-[var(--app-shell-sidebar-width)] lg:flex">
          {activeSecondarySidebar ? <ShortFormSecondarySidebar sidebar={activeSecondarySidebar} /> : null}
          <div className="min-w-0 flex min-h-0 flex-1 flex-col">
            <AppTopBar />
            <main id="app-shell-content" className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <InstantNavigationLoader />
              {children}
            </main>
          </div>
        </div>
      </div>
    </AppShellChromeContext.Provider>
  );
}
