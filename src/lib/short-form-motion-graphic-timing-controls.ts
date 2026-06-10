export interface MotionGraphicTimingControlConfig {
  fields: string[];
  controls: string[];
  extraTargets?: string[];
}

export const MOTION_GRAPHIC_TIMING_CONTROL_CONFIGS: Record<
  string,
  MotionGraphicTimingControlConfig
> = {
  stat_reveal: {
    fields: ["value", "title"],
    controls: ["value", "title"],
  },
  bar_chart: {
    fields: ["title", "data"],
    controls: ["title", "each data <item> / bar group"],
  },
  pie_chart: {
    fields: ["title", "data"],
    controls: ["title", "each data <item> / slice group"],
  },
  line_growth_chart: {
    fields: ["title"],
    controls: ["title", "chart"],
    extraTargets: ["Chart line"],
  },
  comparison_before_after: {
    fields: ["before", "after"],
    controls: ["before", "after"],
  },
  timeline: {
    fields: ["steps"],
    controls: ["each <step> timeline item"],
  },
  cause_effect: {
    fields: ["cause", "effect"],
    controls: ["cause", "arrow", "effect"],
    extraTargets: ["Arrow"],
  },
  caption_word_wall: {
    fields: ["text"],
    controls: [
      "forced-alignment word reveal/highlight",
    ],
    extraTargets: ["Forced-alignment word highlight"],
  },
  ranked_podium: {
    fields: ["items"],
    controls: ["each <step> / ranked item"],
  },
  list: {
    fields: ["title", "listType", "items"],
    controls: ["title", "each <step> / list item"],
  },
  scorecard: {
    fields: ["title", "data"],
    controls: ["title", "each data <item> / score row"],
  },
  research_paper_card: {
    fields: ["source", "title", "finding"],
    controls: ["paper", "source", "title", "finding"],
  },
  good_bad_indicator: {
    fields: ["text"],
    controls: ["text"],
  },
};

export function getMotionGraphicTimingControlConfig(rendererId: string) {
  return MOTION_GRAPHIC_TIMING_CONTROL_CONFIGS[rendererId] || {
    fields: [],
    controls: [],
    extraTargets: [],
  };
}

export function formatMotionGraphicAnimationTimingControls(rendererId: string) {
  const controls = getMotionGraphicTimingControlConfig(rendererId).controls;
  return controls.length > 0 ? controls.join("; ") : "none";
}
