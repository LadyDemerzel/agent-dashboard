// Centralized YouTube workflow phase definitions and status logic

export type PhaseKey = 'research' | 'script' | 'images' | 'audio';
export type PhaseStatus = 'locked' | 'ready' | 'working' | 'complete';

export interface PhaseDefinition {
  key: PhaseKey;
  label: string;
  icon: string;
  agent: string;
}

export const YOUTUBE_PHASES: PhaseDefinition[] = [
  { key: 'research', label: 'Research', icon: '🔍', agent: 'Echo' },
  { key: 'script', label: 'Script', icon: '📜', agent: 'Scribe' },
  { key: 'images', label: 'Images', icon: '🖼️', agent: 'Echo' },
  { key: 'audio', label: 'Audio', icon: '🎙️', agent: 'Ralph' },
];

/** Maps video.status values to the phase currently running */
const STATUS_TO_RUNNING_PHASE: Record<string, PhaseKey> = {
  researching: 'research',
  scripting: 'script',
  collecting_images: 'images',
  generating_audio: 'audio',
};

/** Artifact data the API provides for determining phase completion */
export interface VideoArtifacts {
  has_research: boolean;
  has_script: boolean;
  imageCount: number;
  has_audio: boolean;
  status: string;
}

/** Ordered list of phases for dependency checking */
const PHASE_ORDER: PhaseKey[] = ['research', 'script', 'images', 'audio'];

/** Returns whether the artifact for a given phase exists */
function hasArtifact(phase: PhaseKey, artifacts: VideoArtifacts): boolean {
  switch (phase) {
    case 'research': return artifacts.has_research;
    case 'script': return artifacts.has_script;
    case 'images': return artifacts.imageCount > 0;
    case 'audio': return artifacts.has_audio;
  }
}

/** Returns whether all prerequisite phases are complete */
function prerequisitesMet(phase: PhaseKey, artifacts: VideoArtifacts): boolean {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx === 0) return true; // research has no prerequisites
  const prevPhase = PHASE_ORDER[idx - 1];
  return hasArtifact(prevPhase, artifacts);
}

/**
 * Compute the status of a single workflow phase.
 * Artifact-first: if the artifact exists, the phase is complete regardless of backend status.
 */
export function getYoutubePhaseStatus(phase: PhaseKey, artifacts: VideoArtifacts): PhaseStatus {
  // 1. Artifact-first: completed artifacts override stale backend status
  if (hasArtifact(phase, artifacts)) return 'complete';

  // 2. Check if this phase is currently running (backend status says so)
  const runningPhase = STATUS_TO_RUNNING_PHASE[artifacts.status];
  if (runningPhase === phase) return 'working';

  // 3. Check if prerequisites are met
  if (prerequisitesMet(phase, artifacts)) return 'ready';

  return 'locked';
}

/**
 * Compute statuses for all phases at once.
 */
export function getAllPhaseStatuses(artifacts: VideoArtifacts): Record<PhaseKey, PhaseStatus> {
  return Object.fromEntries(
    PHASE_ORDER.map(phase => [phase, getYoutubePhaseStatus(phase, artifacts)])
  ) as Record<PhaseKey, PhaseStatus>;
}
