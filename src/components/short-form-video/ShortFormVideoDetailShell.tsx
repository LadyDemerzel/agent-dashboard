'use client';

import { useMemo, useState } from 'react';
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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
      setProject(normalizeShortFormProject(payload.data));
    },
  });

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
