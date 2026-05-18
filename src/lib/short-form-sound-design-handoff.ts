export type SoundDesignDecision = "approved" | "skipped";

export interface SoundDesignHandoffInput {
  soundDesignDecision?: SoundDesignDecision;
  soundDesignSkipReason?: string;
  soundDesign?: {
    exists?: boolean;
    status?: string;
    previewAudioUrl?: string;
    previewAudioPath?: string;
    resolution?: {
      previewAudioRelativePath?: string;
      stats?: {
        total?: number;
        unresolved?: number;
      };
      qa?: {
        status?: "pass" | "warn" | "fail";
        previewFresh?: boolean;
        finalFresh?: boolean;
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
  approvalWarnings: string[];
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function getSoundDesignHandoffState(input: SoundDesignHandoffInput): SoundDesignHandoffState {
  const decision = input.soundDesignDecision;
  const skipReason = input.soundDesignSkipReason?.trim() || undefined;
  const soundDesign = input.soundDesign;
  const planStatus = soundDesign?.status?.trim().toLowerCase() || "";
  const planApproved = planStatus === "approved" || planStatus === "published";
  const hasPreview = Boolean(
    soundDesign?.previewAudioUrl
    || soundDesign?.previewAudioPath
    || soundDesign?.resolution?.previewAudioRelativePath
  );
  const unresolvedRaw = soundDesign?.resolution?.stats?.unresolved;
  const unresolvedEvents = typeof unresolvedRaw === "number" && Number.isFinite(unresolvedRaw)
    ? unresolvedRaw
    : null;
  const totalRaw = soundDesign?.resolution?.stats?.total;
  const totalEvents = typeof totalRaw === "number" && Number.isFinite(totalRaw)
    ? totalRaw
    : null;
  const qaStatus = soundDesign?.resolution?.qa?.status;
  const previewFresh = soundDesign?.resolution?.qa?.previewFresh;
  const finalFresh = soundDesign?.resolution?.qa?.finalFresh;
  const hasResolvedEvents = totalEvents !== null && totalEvents > 0 && unresolvedEvents === 0;
  const hasFreshApprovedMix = previewFresh !== false || finalFresh === true;
  const approvalWarnings = [
    ...(qaStatus === "fail"
      ? ["Sound-design QA is failing. Approval will override the QA failure and hand off the current preview mix with warnings."]
      : qaStatus === "warn"
        ? ["Sound-design QA has warnings. Approval will hand off the current preview mix with warnings."]
        : []),
  ];
  const canApprove = Boolean(soundDesign?.exists && planApproved && hasPreview && hasResolvedEvents && hasFreshApprovedMix);
  const canSkip = Boolean(skipReason);
  const canProceedToFinalVideo = (decision === "approved" && canApprove) || (decision === "skipped" && canSkip);

  let gateReason: string | undefined;
  if (decision === "skipped" && !canSkip) {
    gateReason = "Add a brief reason before skipping sound design.";
  } else if (!soundDesign?.exists) {
    gateReason = "Plan sound design first, or explicitly skip it with a short reason.";
  } else if (!planApproved) {
    gateReason = needsReviewPlanStatus(planStatus)
      ? "Approve Plan Sound Design XML before approving the generated sound-design mix for Final Video."
      : "Plan Sound Design XML is not approved yet.";
  } else if (!hasPreview) {
    gateReason = "Render a preview mix before approving Generate Sound Design for the final render.";
  } else if (unresolvedEvents === null) {
    gateReason = "Resolve the sound-design events before approving this handoff for Final Video.";
  } else if (totalEvents === null || totalEvents <= 0) {
    gateReason = "Resolve at least one sound-design event before approving this handoff for Final Video.";
  } else if (unresolvedEvents > 0) {
    gateReason = `Resolve ${unresolvedEvents} remaining ${pluralize(unresolvedEvents, "sound-design event")} before approving this handoff for Final Video.`;
  } else if (previewFresh === false && finalFresh !== true) {
    gateReason = "Render a fresh preview mix before approving this handoff for Final Video.";
  } else if (decision !== "approved" && decision !== "skipped") {
    gateReason = qaStatus === "fail"
      ? "Sound-design QA is failing. Approve anyway to override the QA warning, or auto-fix and re-render first."
      : "Approve the sound-design mix or explicitly skip it with a short reason before Final Video.";
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
    approvalWarnings,
  };
}

function needsReviewPlanStatus(status: string) {
  return status === "needs review" || status === "review";
}
