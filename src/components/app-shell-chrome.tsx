'use client';

import { createContext, useContext } from 'react';
import type { ShortFormSecondaryNavItem } from '@/lib/short-form-secondary-nav';
import type { ShortFormAutoRunState } from '@/lib/short-form-auto-run';

export interface AppShellSecondarySidebarConfig {
  title: string;
  items: ShortFormSecondaryNavItem[];
  breadcrumbLabel?: string;
  autoRun?: ShortFormAutoRunState;
}

export interface AppShellChromeContextValue {
  hasShortFormSecondaryNav: boolean;
  isDesktop: boolean;
  hasDesktopShortFormSidebar: boolean;
  mainCollapsed: boolean;
  mainMobileOpen: boolean;
  shortFormDesktopOpen: boolean;
  shortFormMobileOpen: boolean;
  secondarySidebar: AppShellSecondarySidebarConfig | null;
  setSecondarySidebar: (sidebar: AppShellSecondarySidebarConfig | null) => void;
  clearSecondarySidebar: () => void;
  toggleMainSidebar: () => void;
  closeMainSidebar: () => void;
  toggleShortFormSidebar: () => void;
  closeShortFormSidebar: () => void;
}

export const AppShellChromeContext = createContext<AppShellChromeContextValue | null>(null);

export function useAppShellChrome() {
  const context = useContext(AppShellChromeContext);

  if (!context) {
    throw new Error('useAppShellChrome must be used within AppShell');
  }

  return context;
}
