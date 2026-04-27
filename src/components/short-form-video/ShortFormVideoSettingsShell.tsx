'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { usePolling } from '@/components/usePolling';
import { ShortFormSecondaryShell } from '@/components/short-form-video/ShortFormSecondaryShell';
import {
  getShortFormSettingsNavItems,
  type ShortFormSettingsNavSummary,
} from '@/lib/short-form-secondary-nav';

interface SettingsSummaryResponse {
  success: boolean;
  data?: {
    imageStyles?: { styles?: unknown[] };
    videoRender?: {
      voices?: unknown[];
      musicTracks?: unknown[];
      captionStyles?: unknown[];
    };
    backgroundVideos?: { backgrounds?: unknown[] };
    soundDesign?: { library?: unknown[] };
  };
}

interface ShortFormSettingsShellNavContextValue {
  setDirtySectionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSummaryOverrides: React.Dispatch<React.SetStateAction<Partial<ShortFormSettingsNavSummary>>>;
}

const ShortFormSettingsShellNavContext = createContext<ShortFormSettingsShellNavContextValue | null>(null);

function normalizeSummary(payload: SettingsSummaryResponse | null | undefined): ShortFormSettingsNavSummary | null {
  if (!payload?.success || !payload.data) return null;

  return {
    voiceCount: payload.data.videoRender?.voices?.length || 0,
    soundCount: payload.data.soundDesign?.library?.length || 0,
    styleCount: payload.data.imageStyles?.styles?.length || 0,
    captionStyleCount: payload.data.videoRender?.captionStyles?.length || 0,
    backgroundCount: payload.data.backgroundVideos?.backgrounds?.length || 0,
    musicTrackCount: payload.data.videoRender?.musicTracks?.length || 0,
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
  const [summary, setSummary] = useState<ShortFormSettingsNavSummary>(initialSummary);
  const [dirtySectionIds, setDirtySectionIds] = useState<string[]>(initialSummary.dirtySectionIds || []);
  const [summaryOverrides, setSummaryOverrides] = useState<Partial<ShortFormSettingsNavSummary>>({});

  usePolling<SettingsSummaryResponse>('/api/short-form-videos/settings', {
    intervalMs: 8000,
    enabled: true,
    onData: (payload) => {
      const next = normalizeSummary(payload);
      if (next) setSummary(next);
    },
  });

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
