import { getSoundDesignHandoffState } from '@/lib/short-form-sound-design-handoff';
import type { ShortFormProjectClient as Project } from '@/lib/short-form-video-client';
import {
  buildShortFormDetailHref,
  buildShortFormSettingsHref,
  type ShortFormDetailRouteSection,
  type ShortFormSettingsRouteSection,
} from '@/lib/short-form-video-navigation';
import {
  SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID,
  type ShortFormAutoRunStepId,
} from '@/lib/short-form-auto-run';

export const APP_SHELL_COMPACT_BREAKPOINT_PX = 1360;
export const SHORT_FORM_SECONDARY_NAV_WIDTH = '15rem';

export function routeHasShortFormSecondaryNav(pathname: string) {
  if (pathname.startsWith('/short-form-video/settings/')) return true;
  return /^\/short-form-video\/[^/]+\/[^/]+$/.test(pathname);
}

export type ShortFormSecondaryNavIcon =
  | 'topic'
  | 'hook'
  | 'research'
  | 'text-script'
  | 'narration'
  | 'captions'
  | 'plan-visuals'
  | 'generate-visuals'
  | 'plan-sound-design'
  | 'generate-sound-design'
  | 'final-video';

export interface ShortFormSecondaryNavItem {
  href: string;
  label: string;
  icon?: ShortFormSecondaryNavIcon;
  group?: string;
  status?: string;
  caption?: string;
  meta?: string;
  locked?: boolean;
  dirty?: boolean;
  children?: ShortFormSecondaryNavItem[];
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

function autoRunStepForSection(sectionId: DetailSectionId): ShortFormAutoRunStepId | undefined {
  if (sectionId === 'script') return 'text-script';
  if (sectionId === 'scene-images') return 'generate-visuals';
  if (sectionId === 'video') return 'final-video';
  return SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID[sectionId as ShortFormDetailRouteSection];
}

function getAutoRunSectionStatus(project: Project, sectionId: DetailSectionId) {
  const autoRun = project.autoRun;
  const stepId = autoRunStepForSection(sectionId);
  if (!autoRun || autoRun.status !== 'active' || !stepId) return undefined;
  if (autoRun.failedStep === stepId) return 'failed';
  if (autoRun.currentStep === stepId) return 'working';
  if (autoRun.waitingSteps.includes(stepId)) return 'queued by auto-run';
  return undefined;
}

function getDetailSectionStatus(project: Project | null, sectionId: DetailSectionId): string {
  if (!project) return 'draft';

  const autoRunStatus = getAutoRunSectionStatus(project, sectionId);
  if (autoRunStatus) return autoRunStatus;

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
  const showSceneImages = project
    ? Boolean(
        project.xmlScript.exists ||
          project.sceneImages.pending ||
          project.sceneImages.scenes.length > 0
      )
    : false;
  const showPlanSoundDesign = project ? approved(project.sceneImages.status) : false;
  const showGenerateSoundDesign = project ? Boolean(project.soundDesign.exists) : false;
  const showVideo = project ? approved(project.sceneImages.status) : false;

  return [
    {
      id: 'topic',
      href: buildShortFormDetailHref(projectId, 'topic'),
      label: 'Topic',
      icon: 'topic',
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
      icon: 'hook',
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
      icon: 'research',
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
      icon: 'text-script',
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
      icon: 'narration',
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
      icon: 'captions',
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
      icon: 'plan-visuals',
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
      icon: 'generate-visuals',
      group: 'VISUALS',
      caption: 'Generate, review, and approve scene images from the XML plan.',
      meta: approved(project?.xmlScript.status)
        ? 'XML approved'
        : project?.xmlScript.exists
          ? 'XML plan ready'
          : 'Needs XML visual plan',
      status: getDetailSectionStatus(project, 'scene-images'),
      available: showSceneImages,
      locked: !showSceneImages,
      unlockHint: 'Plan visuals first to unlock generated visuals.',
    },
    {
      id: 'plan-sound-design',
      href: buildShortFormDetailHref(projectId, 'plan-sound-design'),
      label: 'Plan Sound Design',
      icon: 'plan-sound-design',
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
      icon: 'generate-sound-design',
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
      icon: 'final-video',
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
  const pageDirty = (ids: string[]) => ids.some((id) => dirty.has(id));
  const buildItem = (
    section: ShortFormSettingsRouteSection,
    label: string,
    icon: ShortFormSecondaryNavIcon,
    group: string,
    caption: string,
    meta: string,
    dirtyIds: string[],
  ): ShortFormSecondaryNavItem => {
    const isDirty = pageDirty(dirtyIds);
    return {
      href: buildShortFormSettingsHref(section),
      label,
      icon,
      group,
      caption,
      meta,
      dirty: isDirty,
    };
  };

  return [
    buildItem('topic', 'Topic', 'topic', 'WRITING', 'No dashboard-wide settings are needed before a project topic exists.', 'No settings', []),
    buildItem('hook', 'Hook', 'hook', 'WRITING', 'Hook generation and more-hooks prompt templates.', '2 prompts', ['prompt-hooks']),
    buildItem('research', 'Research', 'research', 'WRITING', 'Research generation and revision prompt templates.', '2 prompts', ['prompt-research']),
    buildItem('text-script', 'Text Script', 'text-script', 'WRITING', 'Text-script loop prompts, iteration defaults, and post-processing rules.', '3 prompts', ['text-script-prompts']),
    buildItem('generate-narration-audio', 'Generate Narration Audio', 'narration', 'NARRATION', 'Narration voice library plus silence-trimming defaults.', `${summary?.voiceCount || 0} voices`, ['tts-voice', 'pause-removal']),
    buildItem('plan-captions', 'Plan Captions', 'captions', 'NARRATION', 'Reusable caption-style presets and animation definitions.', `${summary?.captionStyleCount || 0} caption styles`, ['caption-styles']),
    buildItem('plan-visuals', 'Plan Visuals', 'plan-visuals', 'VISUALS', 'Full Scribe prompt templates for XML visual planning.', 'Full prompt', ['xml-visual-planning']),
    {
      ...buildItem(
        'generate-visuals-motion-graphics',
        'Generate Visuals',
        'generate-visuals',
        'VISUALS',
        'Motion graphics, Nano Banana templates, and the reusable image-style library.',
        `${summary?.styleCount || 0} styles`,
        ['motion-graphics', 'image-templates', 'image-styles'],
      ),
      children: [
        buildItem(
          'generate-visuals-motion-graphics',
          'Motion Graphics',
          'generate-visuals',
          'VISUALS',
          'Deterministic animated visual templates available during visual planning.',
          'Templates',
          ['motion-graphics'],
        ),
        buildItem(
          'generate-visuals-image-generation-prompts',
          'Image Generation Prompts',
          'generate-visuals',
          'VISUALS',
          'Prompt templates used by direct scene-image generation.',
          'Prompts',
          ['image-templates'],
        ),
        buildItem(
          'generate-visuals-image-styles',
          'Image Styles',
          'generate-visuals',
          'VISUALS',
          'Reusable image styles and global image-generation defaults.',
          `${summary?.styleCount || 0} styles`,
          ['image-styles'],
        ),
      ],
    },
    buildItem('plan-sound-design', 'Plan Sound Design', 'plan-sound-design', 'SOUND DESIGN', 'Full sound-design planning prompt templates and revision-note instructions.', '2 prompts', ['sound-library']),
    buildItem('generate-sound-design', 'Generate Sound Design', 'generate-sound-design', 'SOUND DESIGN', 'Saved SFX and music library plus mix defaults for sound-design generation.', `${summary?.soundCount || 0} sounds · ${summary?.musicTrackCount || 0} tracks`, ['sound-library']),
    buildItem('final-video', 'Final Video', 'final-video', 'RENDER', 'Background loops, music presets, and final-render defaults.', `${summary?.backgroundCount || 0} loops · ${summary?.musicTrackCount || 0} tracks`, ['background-videos', 'music-library', 'final-video-render']),
  ];
}
