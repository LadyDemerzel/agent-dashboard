import { getSoundDesignHandoffState } from '@/lib/short-form-sound-design-handoff';
import type { ShortFormProjectClient as Project } from '@/lib/short-form-video-client';
import {
  buildShortFormDetailHref,
  buildShortFormSettingsHref,
  type ShortFormDetailRouteSection,
} from '@/lib/short-form-video-navigation';

export const APP_SHELL_COMPACT_BREAKPOINT_PX = 1360;
export const SHORT_FORM_SECONDARY_NAV_WIDTH = '15rem';

export function routeHasShortFormSecondaryNav(pathname: string) {
  if (pathname.startsWith('/short-form-video/settings/')) return true;
  return /^\/short-form-video\/[^/]+\/[^/]+$/.test(pathname);
}

export interface ShortFormSecondaryNavItem {
  href: string;
  label: string;
  group?: string;
  status?: string;
  caption?: string;
  meta?: string;
  locked?: boolean;
  dirty?: boolean;
}

type DetailSectionId = 'topic' | 'hook' | 'research' | 'script' | 'generate-narration-audio' | 'plan-captions' | 'plan-visuals' | 'scene-images' | 'plan-sound-design' | 'generate-sound-design' | 'video';

export interface DetailRouteSectionItem extends ShortFormSecondaryNavItem {
  id: ShortFormDetailRouteSection;
  available: boolean;
  unlockHint?: string;
}

export function approved(status?: string) {
  return status === 'approved' || status === 'published';
}

function soundDesignStageStatus(project: Project) {
  if (project.soundDesign.pending) return 'working';

  const handoff = getSoundDesignHandoffState(project);
  if (handoff.canProceedToFinalVideo) return handoff.status;
  if (project.soundDesign.exists) return handoff.canApprove ? 'ready' : 'needs review';
  return approved(project.sceneImages.status) ? 'ready' : (project.soundDesign.status || 'draft');
}

function getDetailSectionStatus(project: Project | null, sectionId: DetailSectionId): string {
  if (!project) return 'draft';

  switch (sectionId) {
    case 'topic':
      return project.topic ? 'approved' : 'draft';
    case 'hook':
      return project.hooks.pending ? 'working' : project.selectedHookText ? 'approved' : 'draft';
    case 'research':
      return project.research.pending ? 'working' : project.research.status || 'draft';
    case 'script':
      return project.script.pending ? 'working' : project.script.status || 'draft';
    case 'generate-narration-audio': {
      const narrationSteps = project.xmlScript.pipeline?.steps.filter(
        (step) => step.id === 'narration' || step.id === 'silence-removal' || step.id === 'alignment'
      ) || [];
      if (narrationSteps.some((step) => step.status === 'failed')) return 'failed';
      if (narrationSteps.some((step) => step.status === 'active')) return 'working';
      if (narrationSteps.length > 0 && narrationSteps.every((step) => step.status === 'completed')) return 'approved';
      if (project.xmlScript.audioUrl) return 'approved';
      return approved(project.script.status) ? 'ready' : 'draft';
    }
    case 'plan-captions': {
      const captionsStep = project.xmlScript.pipeline?.steps.find((step) => step.id === 'captions');
      if (captionsStep?.status === 'failed') return 'failed';
      if (captionsStep?.status === 'active') return 'working';
      if (captionsStep?.status === 'completed') return 'approved';
      if (project.xmlScript.captions?.length) return 'approved';
      return getDetailSectionStatus(project, 'generate-narration-audio') === 'approved' ? 'ready' : 'draft';
    }
    case 'plan-visuals': {
      const visualsStep = project.xmlScript.pipeline?.steps.find((step) => step.id === 'xml');
      if (visualsStep?.status === 'failed') return 'failed';
      if (visualsStep?.status === 'active') return 'working';
      if (project.xmlScript.exists) return project.xmlScript.status || 'needs review';
      if (visualsStep?.status === 'completed') return 'needs review';
      return getDetailSectionStatus(project, 'plan-captions') === 'approved' ? 'ready' : 'draft';
    }
    case 'scene-images':
      return project.sceneImages.pending ? 'working' : project.sceneImages.status || 'draft';
    case 'plan-sound-design':
      return project.soundDesign.pending
        ? 'working'
        : project.soundDesign.exists
          ? project.soundDesign.status || 'needs review'
          : approved(project.sceneImages.status)
            ? 'ready'
            : 'draft';
    case 'generate-sound-design':
      return soundDesignStageStatus(project);
    case 'video': {
      const handoff = getSoundDesignHandoffState(project);
      if (project.video.pipeline?.status === 'failed' || project.video.revision?.isFailed) return 'failed';
      if (project.video.pending || project.video.pipeline?.status === 'running') return 'working';
      if (project.video.pipeline?.status === 'completed') return 'completed';
      if (!approved(project.sceneImages.status)) return 'draft';
      if (!handoff.canProceedToFinalVideo) return 'blocked';
      return project.video.status || 'ready';
    }
    default:
      return 'draft';
  }
}

export function getDetailRouteItems(projectId: string, project: Project | null): DetailRouteSectionItem[] {
  const showHook = project ? project.topic.trim().length > 0 : false;
  const showResearch = project ? Boolean(project.selectedHookText) : false;
  const showScript = project ? approved(project.research.status) : false;
  const narrationStatus = getDetailSectionStatus(project, 'generate-narration-audio');
  const captionsStatus = getDetailSectionStatus(project, 'plan-captions');
  const showNarrationAudio = showScript;
  const hasCaptionArtifact = project
    ? Boolean(project.xmlScript.captions?.length || project.xmlScript.pipeline?.steps.some((step) => step.id === 'captions'))
    : false;
  const showPlanCaptions = project
    ? showScript && (narrationStatus === 'approved' || hasCaptionArtifact)
    : false;
  const showPlanVisuals = project
    ? showScript && (captionsStatus === 'approved' || project.xmlScript.exists || project.xmlScript.status === 'approved')
    : false;
  const showSceneImages = project ? approved(project.xmlScript.status) : false;
  const showPlanSoundDesign = project ? approved(project.sceneImages.status) : false;
  const showGenerateSoundDesign = project ? Boolean(project.soundDesign.exists) : false;
  const showVideo = project ? approved(project.sceneImages.status) : false;

  return [
    {
      id: 'topic',
      href: buildShortFormDetailHref(projectId, 'topic'),
      label: 'Topic',
      group: 'WRITING',
      caption: 'Start the project and trigger hook generation.',
      meta: project?.topic ? 'Topic saved' : 'Needs topic',
      status: getDetailSectionStatus(project, 'topic'),
      available: true,
    },
    {
      id: 'hook',
      href: buildShortFormDetailHref(projectId, 'hook'),
      label: 'Hook',
      group: 'WRITING',
      caption: 'Generate, review, and select the hook that drives the rest of the workflow.',
      meta: project?.selectedHookText ? 'Hook selected' : 'Waiting for topic',
      status: getDetailSectionStatus(project, 'hook'),
      available: showHook,
      locked: !showHook,
      unlockHint: 'Save a topic first to open the hook page.',
    },
    {
      id: 'research',
      href: buildShortFormDetailHref(projectId, 'research'),
      label: 'Research',
      group: 'WRITING',
      caption: 'Review Oracle research tied to the selected hook.',
      meta: project?.selectedHookText ? 'Hook approved' : 'Needs hook selection',
      status: getDetailSectionStatus(project, 'research'),
      available: showResearch,
      locked: !showResearch,
      unlockHint: 'Select a hook first to unlock research.',
    },
    {
      id: 'text-script',
      href: buildShortFormDetailHref(projectId, 'text-script'),
      label: 'Text Script',
      group: 'WRITING',
      caption: 'Write and approve the plain narration script before XML planning starts.',
      meta: approved(project?.research.status) ? 'Research approved' : 'Needs approved research',
      status: getDetailSectionStatus(project, 'script'),
      available: showScript,
      locked: !showScript,
      unlockHint: 'Approve the research first to unlock the text script.',
    },
    {
      id: 'generate-narration-audio',
      href: buildShortFormDetailHref(projectId, 'generate-narration-audio'),
      label: 'Generate Narration Audio',
      group: 'NARRATION',
      caption: 'Generate narration audio, remove pauses, and force-align the processed WAV.',
      meta: approved(project?.script.status) ? 'Text script approved' : 'Needs approved text script',
      status: getDetailSectionStatus(project, 'generate-narration-audio'),
      available: showNarrationAudio,
      locked: !showNarrationAudio,
      unlockHint: 'Approve the text script first to generate narration audio.',
    },
    {
      id: 'plan-captions',
      href: buildShortFormDetailHref(projectId, 'plan-captions'),
      label: 'Plan Captions',
      group: 'NARRATION',
      caption: 'Generate deterministic caption JSON from the latest alignment.',
      meta: narrationStatus === 'approved' ? 'Narration aligned' : 'Needs narration audio',
      status: getDetailSectionStatus(project, 'plan-captions'),
      available: showPlanCaptions,
      locked: !showPlanCaptions,
      unlockHint: 'Generate and align narration audio first to unlock captions.',
    },
    {
      id: 'plan-visuals',
      href: buildShortFormDetailHref(projectId, 'plan-visuals'),
      label: 'Plan Visuals',
      group: 'VISUALS',
      caption: 'Write the XML asset and timeline plan from approved narration timing and captions.',
      meta: captionsStatus === 'approved' ? 'Captions planned' : 'Needs caption plan',
      status: getDetailSectionStatus(project, 'plan-visuals'),
      available: showPlanVisuals,
      locked: !showPlanVisuals,
      unlockHint: 'Plan captions first to unlock visual planning.',
    },
    {
      id: 'generate-visuals',
      href: buildShortFormDetailHref(projectId, 'generate-visuals'),
      label: 'Generate Visuals',
      group: 'VISUALS',
      caption: 'Generate, review, and approve scene images from the XML plan.',
      meta: approved(project?.xmlScript.status) ? 'XML approved' : 'Needs approved XML',
      status: getDetailSectionStatus(project, 'scene-images'),
      available: showSceneImages,
      locked: !showSceneImages,
      unlockHint: 'Approve the XML script first to unlock generated visuals.',
    },
    {
      id: 'plan-sound-design',
      href: buildShortFormDetailHref(projectId, 'plan-sound-design'),
      label: 'Plan Sound Design',
      group: 'SOUND DESIGN',
      caption: 'Generate and review the Plan Sound Design XML artifact.',
      meta: approved(project?.sceneImages.status) ? 'Generate Visuals approved' : 'Needs approved generated visuals',
      status: getDetailSectionStatus(project, 'plan-sound-design'),
      available: showPlanSoundDesign,
      locked: !showPlanSoundDesign,
      unlockHint: 'Approve generated visuals first to unlock Plan Sound Design.',
    },
    {
      id: 'generate-sound-design',
      href: buildShortFormDetailHref(projectId, 'generate-sound-design'),
      label: 'Generate Sound Design',
      group: 'SOUND DESIGN',
      caption: 'Resolve assets, render audio, tune event overrides, and hand off for final render.',
      meta: project?.soundDesign.exists ? 'XML plan ready' : 'Needs Plan Sound Design XML',
      status: getDetailSectionStatus(project, 'generate-sound-design'),
      available: showGenerateSoundDesign,
      locked: !showGenerateSoundDesign,
      unlockHint: 'Plan sound design first to unlock audio generation.',
    },
    {
      id: 'final-video',
      href: buildShortFormDetailHref(projectId, 'final-video'),
      label: 'Final Video',
      group: 'RENDER',
      caption: 'Render and review the finished short-form export.',
      meta: approved(project?.sceneImages.status) ? 'Ready after handoff' : 'Needs approved generated visuals',
      status: getDetailSectionStatus(project, 'video'),
      available: showVideo,
      locked: !showVideo,
      unlockHint: 'Approve generated visuals first to unlock the final render page.',
    },
  ];
}

export interface ShortFormSettingsNavSummary {
  voiceCount?: number;
  soundCount?: number;
  styleCount?: number;
  captionStyleCount?: number;
  backgroundCount?: number;
  musicTrackCount?: number;
  dirtySectionIds?: string[];
}

export function getShortFormSettingsNavItems(summary?: ShortFormSettingsNavSummary): ShortFormSecondaryNavItem[] {
  const dirty = new Set(summary?.dirtySectionIds || []);
  const promptsDirty = dirty.has('prompt-hooks') || dirty.has('prompt-research') || dirty.has('text-script-prompts') || dirty.has('xml-visual-planning');
  const audioDirty = dirty.has('pause-removal') || dirty.has('tts-voice');

  return [
    {
      href: buildShortFormSettingsHref('prompts'),
      label: 'Prompts',
      caption: 'Hooks, research, narration script, and XML visual-planning prompts.',
      meta: '4 editable sections',
      status: promptsDirty ? 'needs review' : 'approved',
      dirty: promptsDirty,
    },
    {
      href: buildShortFormSettingsHref('audio'),
      label: 'Audio',
      caption: 'Narration voice library plus pause-removal and chroma-key defaults.',
      meta: `${summary?.voiceCount || 0} voices`,
      status: audioDirty ? 'needs review' : 'approved',
      dirty: audioDirty,
    },
    {
      href: buildShortFormSettingsHref('sound-library'),
      label: 'Sound Library',
      caption: 'Shared prompt, mix defaults, and reusable SFX library.',
      meta: `${summary?.soundCount || 0} sounds`,
      status: dirty.has('sound-library') ? 'needs review' : 'approved',
      dirty: dirty.has('sound-library'),
    },
    {
      href: buildShortFormSettingsHref('images'),
      label: 'Images',
      caption: 'Nano Banana prompt templates and the reusable image-style library.',
      meta: `${summary?.styleCount || 0} styles`,
      status: dirty.has('image-templates') || dirty.has('image-styles') ? 'needs review' : 'approved',
      dirty: dirty.has('image-templates') || dirty.has('image-styles'),
    },
    {
      href: buildShortFormSettingsHref('captions'),
      label: 'Captions',
      caption: 'Reusable caption-style presets and animation definitions.',
      meta: `${summary?.captionStyleCount || 0} caption styles`,
      status: dirty.has('caption-styles') ? 'needs review' : 'approved',
      dirty: dirty.has('caption-styles'),
    },
    {
      href: buildShortFormSettingsHref('backgrounds'),
      label: 'Backgrounds',
      caption: 'Looping background videos used behind generated scene images.',
      meta: `${summary?.backgroundCount || 0} loops`,
      status: dirty.has('background-videos') ? 'needs review' : 'approved',
      dirty: dirty.has('background-videos'),
    },
    {
      href: buildShortFormSettingsHref('music'),
      label: 'Music',
      caption: 'Saved soundtrack presets and preview generation settings.',
      meta: `${summary?.musicTrackCount || 0} tracks`,
      status: dirty.has('music-library') ? 'needs review' : 'approved',
      dirty: dirty.has('music-library'),
    },
  ];
}
