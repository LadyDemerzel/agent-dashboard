'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiDataFetcher, realtimeSWRConfig } from '@/lib/swr-fetcher';
import { ShortFormSecondaryShell } from '@/components/short-form-video/ShortFormSecondaryShell';
import {
  getShortFormSettingsNavItems,
  type ShortFormSettingsNavSummary,
} from '@/lib/short-form-secondary-nav';

interface SettingsSummaryData {
  imageStyles?: { styles?: unknown[] };
  videoRender?: {
    voices?: unknown[];
    musicTracks?: unknown[];
    captionStyles?: unknown[];
  };
  soundDesign?: { library?: unknown[] };
}

interface ShortFormSettingsShellNavContextValue {
  setDirtySectionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSummaryOverrides: React.Dispatch<React.SetStateAction<Partial<ShortFormSettingsNavSummary>>>;
}

const ShortFormSettingsShellNavContext = createContext<ShortFormSettingsShellNavContextValue | null>(null);

function normalizeSummary(payload: SettingsSummaryData | null | undefined): ShortFormSettingsNavSummary | null {
  if (!payload) return null;

  return {
    voiceCount: payload.videoRender?.voices?.length || 0,
    soundCount: payload.soundDesign?.library?.length || 0,
    styleCount: payload.imageStyles?.styles?.length || 0,
    captionStyleCount: payload.videoRender?.captionStyles?.length || 0,
    musicTrackCount: payload.videoRender?.musicTracks?.length || 0,
  };
}

export function useShortFormSettingsShellNav() {
  return useContext(ShortFormSettingsShellNavContext);
}

export function ShortFormVideoSettingsShell({
  initialSummary,
  children,
}: {
  initialSummary: ShortFormSettingsNavSummary;
  children: React.ReactNode;
}) {
  const [dirtySectionIds, setDirtySectionIds] = useState<string[]>(initialSummary.dirtySectionIds || []);
  const [summaryOverrides, setSummaryOverrides] = useState<Partial<ShortFormSettingsNavSummary>>({});

  const { data: settingsSummaryPayload } = useSWR<SettingsSummaryData>(
    '/api/short-form-videos/settings',
    apiDataFetcher,
    {
      ...realtimeSWRConfig,
      refreshInterval: 8000,
    },
  );

  const summary = useMemo(
    () => normalizeSummary(settingsSummaryPayload) || initialSummary,
    [initialSummary, settingsSummaryPayload]
  );

  const navSummary = useMemo<ShortFormSettingsNavSummary>(
    () => ({
      ...summary,
      ...summaryOverrides,
      dirtySectionIds,
    }),
    [dirtySectionIds, summary, summaryOverrides]
  );

  const settingsNavItems = useMemo(() => getShortFormSettingsNavItems(navSummary), [navSummary]);
  const contextValue = useMemo<ShortFormSettingsShellNavContextValue>(
    () => ({
      setDirtySectionIds,
      setSummaryOverrides,
    }),
    []
  );

  return (
    <ShortFormSettingsShellNavContext.Provider value={contextValue}>
      <ShortFormSecondaryShell title="Settings" items={settingsNavItems}>
        {children}
      </ShortFormSecondaryShell>
    </ShortFormSettingsShellNavContext.Provider>
  );
}
