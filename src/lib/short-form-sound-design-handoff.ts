export type SoundDesignDecision = "approved" | "skipped";

export interface SoundDesignHandoffInput {
  soundDesignDecision?: SoundDesignDecision;
  soundDesignSkipReason?: string;
  soundDesign?: {
    exists?: boolean;
    previewAudioUrl?: string;
    previewAudioPath?: string;
    resolution?: {
      previewAudioRelativePath?: string;
      stats?: {
        unresolved?: number;
      };
    };
  };
}

export interface SoundDesignHandoffState {
  decision?: SoundDesignDecision;
  skipReason?: string;
  hasPreview: boolean;
  unresolvedEvents: number | null;
  canApprove: boolean;
  canSkip: boolean;
  canProceedToFinalVideo: boolean;
  status: "approved" | "skipped" | "ready" | "needs review" | "blocked";
  gateReason?: string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function getSoundDesignHandoffState(input: SoundDesignHandoffInput): SoundDesignHandoffState {
  const decision = input.soundDesignDecision;
  const skipReason = input.soundDesignSkipReason?.trim() || undefined;
  const soundDesign = input.soundDesign;
  const hasPreview = Boolean(
    soundDesign?.previewAudioUrl
    || soundDesign?.previewAudioPath
    || soundDesign?.resolution?.previewAudioRelativePath
  );
  const unresolvedRaw = soundDesign?.resolution?.stats?.unresolved;
  const unresolvedEvents = typeof unresolvedRaw === "number" && Number.isFinite(unresolvedRaw)
    ? unresolvedRaw
    : null;
  const canApprove = Boolean(soundDesign?.exists && hasPreview && unresolvedEvents === 0);
  const canSkip = Boolean(skipReason);
  const canProceedToFinalVideo = (decision === "approved" && canApprove) || (decision === "skipped" && canSkip);

  let gateReason: string | undefined;
  if (decision === "skipped" && !canSkip) {
    gateReason = "Add a brief reason before skipping sound design.";
  } else if (!soundDesign?.exists) {
    gateReason = "Plan sound design first, or explicitly skip it with a short reason.";
  } else if (!hasPreview) {
    gateReason = "Render a preview mix before approving Generate Sound Design for the final render.";
  } else if (unresolvedEvents === null) {
    gateReason = "Resolve the sound-design events before approving this handoff for Final Video.";
  } else if (unresolvedEvents > 0) {
    gateReason = `Resolve ${unresolvedEvents} remaining ${pluralize(unresolvedEvents, "sound-design event")} before approving this handoff for Final Video.`;
  } else if (decision !== "approved" && decision !== "skipped") {
    gateReason = "Approve the sound-design mix or explicitly skip it with a short reason before Final Video.";
  }

  return {
    decision,
    skipReason,
    hasPreview,
    unresolvedEvents,
    canApprove,
    canSkip,
    canProceedToFinalVideo,
    status: canProceedToFinalVideo
      ? (decision as SoundDesignDecision)
      : canApprove
        ? "ready"
        : soundDesign?.exists
          ? "needs review"
          : "blocked",
    gateReason,
  };
}
