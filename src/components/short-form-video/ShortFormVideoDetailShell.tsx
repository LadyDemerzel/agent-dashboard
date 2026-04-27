'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePolling } from '@/components/usePolling';
import { ShortFormSecondaryShell } from '@/components/short-form-video/ShortFormSecondaryShell';
import {
  getDetailRouteItems,
  type DetailRouteSectionItem,
} from '@/lib/short-form-secondary-nav';
import {
  normalizeShortFormProject,
  type ShortFormProjectClient as Project,
} from '@/lib/short-form-video-client';
import {
  SHORT_FORM_PROJECT_OPTIMISTIC_UPDATE_EVENT,
  type ShortFormProjectOptimisticUpdateDetail,
} from '@/lib/short-form-project-events';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function shortFormProjectChanged(current: Project | null, next: Project) {
  if (!current) return true;
  return JSON.stringify(current) !== JSON.stringify(next);
}

export function ShortFormVideoDetailShell({
  projectId,
  initialProject,
  children,
}: {
  projectId: string;
  initialProject: Project | null;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(initialProject);

  usePolling<ApiResponse<Project>>(projectId ? `/api/short-form-videos/${projectId}` : null, {
    intervalMs: 5000,
    enabled: Boolean(projectId),
    onData: (payload) => {
      if (!payload.success || !payload.data) return;
      const normalized = normalizeShortFormProject(payload.data);
      setProject((current) =>
        shortFormProjectChanged(current, normalized) ? normalized : current
      );
    },
  });

  useEffect(() => {
    function handleOptimisticUpdate(event: Event) {
      const detail = (event as CustomEvent<ShortFormProjectOptimisticUpdateDetail>).detail;
      if (!detail || detail.projectId !== projectId) return;

      setProject((current) => {
        if (!current) return current;

        const nextPendingStages = typeof detail.soundDesignPending === 'boolean'
          ? detail.soundDesignPending
            ? Array.from(new Set([...current.pendingStages, 'sound-design' as const]))
            : current.pendingStages.filter((stage) => stage !== 'sound-design')
          : current.pendingStages;

        return {
          ...current,
          pendingStages: nextPendingStages,
          soundDesign: {
            ...current.soundDesign,
            ...(typeof detail.soundDesignPending === 'boolean' ? { pending: detail.soundDesignPending } : {}),
            ...(typeof detail.soundDesignStatus === 'string' ? { status: detail.soundDesignStatus } : {}),
          },
        };
      });
    }

    window.addEventListener(SHORT_FORM_PROJECT_OPTIMISTIC_UPDATE_EVENT, handleOptimisticUpdate);
    return () => window.removeEventListener(SHORT_FORM_PROJECT_OPTIMISTIC_UPDATE_EVENT, handleOptimisticUpdate);
  }, [projectId]);

  const detailItems = useMemo<DetailRouteSectionItem[]>(
    () => getDetailRouteItems(projectId, project),
    [project, projectId]
  );

  const breadcrumbLabel = useMemo(() => {
    const hookText = project?.hooks?.selectedHookText?.trim();
    if (hookText) return hookText;

    const topicText = project?.topic?.trim();
    if (topicText) return topicText;

    const titleText = project?.title?.trim();
    return titleText || 'Project';
  }, [project]);

  return (
    <ShortFormSecondaryShell title={breadcrumbLabel} items={detailItems} breadcrumbLabel={breadcrumbLabel}>
      {children}
    </ShortFormSecondaryShell>
  );
}
