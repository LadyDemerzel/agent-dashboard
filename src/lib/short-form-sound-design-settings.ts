import fs from "fs";
import path from "path";
import { extractBody } from "@/lib/frontmatter";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";
import { getVersionedShortFormSettingsPath } from "@/lib/short-form-settings-paths";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const SHORT_FORM_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos"
);

const SETTINGS_PATH = getVersionedShortFormSettingsPath("_sound-design-settings.json");
const SOUND_LIBRARY_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_sound-library");
const QUIETER_SFX_GAIN_DB_SHIFT = -3;

const DEFAULT_PLANNING_BRIEF_TEMPLATE = [
  "Aim for one signature sonic moment per section, with restraint between signatures. The goal is a few cues a viewer would notice and remember, not a continuous bed of ticks.",
  "Choose one coherent style palette before individual cues (clean tech, gritty athletic, cinematic trailer, organic/nature, glitch/digital, playful UI, premium editorial, documentary realism). State the chosen palette in the rationale of the first cue and keep it coherent unless a beat intentionally breaks it.",
  "Use the saved sound-design library when choosing cues. Match style palette, frequency band, layer role, and literalness metadata when present. Do not invent assetIds that are not in the library.",
  "Per-section cue budget for a normal 30-90 second short. Plan within these caps, not toward them:",
  "  - Hook (0-4s): 1 impact + 1 riser or whoosh + at most 2 micro-accents (ticks/taps/clicks).",
  "  - Thesis or reveal beats: a single layered group (low + mid + high) sharing one groupId. No additional ticks inside the reveal window.",
  "  - Stat or chart sections: at most one tick per discrete data point being revealed, not per word.",
  "  - Instruction or how-to beats: tactile foley (wood tap, organic tap) only on physical actions or step transitions.",
  "  - Pass-fail or warning beats: a contrast pair (sharp high tick + low body tick or hit). No more.",
  "  - Final beat: payoff impact + reverb tail. Leave 0.4-0.8s of decay before the cut. Do not stack ticks on the final word.",
  "Hard caps for a 60-90 second short: <= 18 ticks/clicks/taps total, <= 30 total <effect/> cues. Exceed only with explicit per-cue justification in rationale.",
  "Asset rotation rule: no two consecutive cues of the same type may share the same assetId. Spread tick variety across the available library rather than reusing the same 3-4 ticks.",
  "Leave-silence rule: in any 6-second window of active narration, at least one >= 1.5s gap must have no transient cue (clicks/impacts/whooshes). Beds and music may continue.",
  "Use whooshes only on actual visual motion (whip, swipe, camera move, large graphic sweep). Do not use a whoosh as a generic transition sound. If the cut has no visual motion, use a tick or a riser-tail instead.",
  "Motion-graphic boundary rule: always add a tasteful transition SFX when the picture moves from a nano-banana/generated image/static visual into a motion_graphic visual, and when it moves from a motion_graphic visual back to a generated/static image. Motion_graphic-to-motion_graphic transition SFX are optional and should be used only when the cut needs help.",
  "Motion-graphic interior rule: do not add Scribe-planned non-music/non-ambience SFX inside the interior of motion_graphic scenes. The dashboard renderer/resolver owns deterministic internal motion-graphic cues because it knows the template animation timings. Music, ambience beds, and transition SFX around motion-graphic boundaries are allowed.",
  "Rationale for the motion-graphic interior rule: do not guess sounds for bars, text, cards, arrows, charts, or other template internals. Those cues are baked deterministically by the motion-graphic template when appropriate.",
  "Risers and uplifters belong before reveals, drops, and section turns. Each riser must resolve into either an impact, a stinger, or a music payoff within 100-300 ms of its end.",
  "For tentpole beats (hook, thesis/reveal, mid-point pivot, final payoff), plan a frequency-layered group with shared groupId: low weight (rumble/bass/sub), mid body (impact/motion core), high air (tick/sparkle/texture). Every tentpole must have all three layers OR be explicitly marked rationale=\"silence-for-contrast\".",
  "Distinguish literal, stylized, and emotional-metaphor cues. Use emotional-metaphor when the sound should match the feeling rather than the visible object.",
  "Score this video like a film or TV editor would. Music is the primary emotional carrier, not background wallpaper. Plan an emotional arc first, then pick music to serve that arc, then write SFX on top.",
  "Before placing any music segment, write a one-line emotional arc plan in the rationale of the first <segment>: name the 2-4 emotional beats the video moves through (for example: \"curiosity -> proof momentum -> warm instruction -> decisive lift\" or \"tension setup -> reveal drop -> contemplative reset -> triumphant payoff\"). The arc must have at least one mood shift; static one-mood scores are not allowed for videos longer than 20 seconds.",
  "Default to multiple music segments. Required minimums: videos > 20s need >= 2 segments; videos > 50s need >= 3 segments; videos > 75s need >= 4. Each segment owns one emotional beat. A single static segment across a 60-90s video is invalid.",
  "Pick saved music trackIds by metadata in the music library JSON: mood, pacing, bpm, key, energy, emotionalArc, intensityCurve, bestSceneTypes, comparableTo. Do not pick by trackId name guessing. If two tracks fit, prefer the one whose intensityCurve and emotionalArc match the section.",
  "Segment-to-section mapping (use as defaults, override with explicit rationale):",
  "  - Hook / curiosity / tease: strongly prefer dramatic, high-tension, cinematic, or magnetic tracks/stingers with energy=medium-high/high, pacing=held/pulsing/driving, intensityCurve=rising/swelling. The hook should feel like it pulls the viewer in, then it may transition into cleaner proof or instruction music after the opening beat.",
  "  - Proof / data / build: tracks with mood=clean-tech/confident, pacing=rhythmic, bpm 100-128, intensityCurve=steady-or-rising.",
  "  - Instruction / how-to / tactile: tracks with mood=warm/lo-fi, pacing=relaxed groove, bpm 80-100, intensityCurve=steady, energy=medium-low.",
  "  - Tension / warning / contrast: tracks with mood=tense/suspense, pacing=held or pulsing, intensityCurve=swelling, energy=medium.",
  "  - Reveal / climax / payoff: tracks with mood=lift/triumphant/decisive, pacing=upbeat, intensityCurve=rising-or-peak, energy=high.",
  "  - Resolution / cool-down / aftermath: tracks with mood=contemplative/warm-resolve, pacing=relaxed, intensityCurve=falling, energy=low to medium-low.",
  "Music transitions between segments must be intentional, not crossfades by default. Choose one connector per transition: (a) crossfade 0.6-1.5s when the new track sits in a similar register, (b) suckback (250-500ms of music ducked to -16 dB) + reverse-tail riser into the new track on a downbeat reveal, (c) reverb tail on the outgoing segment + 200ms music gap + clean drop-in on the new section, (d) musical stinger or impact on the downbeat to land the change. Note the chosen connector in the segment rationale.",
  "Music-only scoring beats are valid effects. When the picture wants emotional weight but no SFX, write rationale=\"music-carry\" or rationale=\"silence-for-contrast\" on the empty window. Tasteful silence between music beats is part of the score.",
  "Plan a music-driven climax. Identify the single biggest emotional beat (the reveal, the thesis, the final lift) and design the surrounding music for it: music drop or impact on the downbeat, lower gainDb on the prior segment to make the climax segment 2-3 dB louder, and a clear musical resolution after.",
  "Music gainDb is the literal relative gain. The renderer no longer multiplies it by any hidden musicVolume factor: a segment with gainDb=\"-10\" lands at -10 dB relative to narration. Plan accordingly.",
  "Music gain shaping (target range -13.5 to -5.5 dB): hook segment -8.5 to -6.5 dB; proof/build -9.5 to -7.5 dB; instruction sections -11.5 to -9.5 dB to let the voice breathe; climax/payoff segment -7.5 to -5.5 dB (the loudest segment of the score); resolution -10.5 to -8.5 dB. These targets are about 2.5 dB louder than the prior baseline while keeping narration primary. Do not run music flat across all segments. Aim for the music bus integrated LUFS to land within 4-8 LU below narration LUFS.",
  "Loop-friendly tracks (loopFriendly=true in library JSON) can extend beyond their generated duration via stream loop. Tracks marked loopFriendly=false should not be looped; if the section is longer than the track, split it into two segments or pick a different track.",
  "Narration owns the mix, but music must remain clearly audible. Plan musicDuckingDb between -6 and -4 (tasteful duck under speech). Plan musicDuckingUnderTransientsDb between -3 and -1 (light duck under transient SFX hits) -- it stacks per-cue, so a heavy SFX coverage with -4 dB duck will bury the music. Pair ducking with midrange EQ carving around 1.8-2.4 kHz so music sits beside the voice rather than under it.",
  "Music audibility QA target: the rendered music-only bus integrated LUFS should land within 12 LU of the narration+music (no-SFX) mix LUFS. If the bus is more than 12 LU below, the QA flags music-too-quiet and the design will need a higher gainDb or shallower duck.",
  "Absolute minimum SFX gain floors (apply regardless of the music gain in that window): impacts >= -9 dB, clicks/ticks/taps >= -10 dB, risers >= -11 dB, whooshes >= -11 dB. These are about 3 dB quieter than the prior baseline (roughly 30% less amplitude) while still preserving audibility after mastering.",
  "Relative-to-music gain rule (applied on top of the absolute floors above): transients should sit about 1 dB above the loudest music segment they overlap, while risers/whooshes may sit roughly even with the music when the music-under-transients sidechain is active. If music is at -10 dB, plan transients around -9 dB and risers/whooshes around -10 to -11 dB. Do NOT push transients far above music -- the music-under-transients sidechain already gives them headroom.",
  "Ambience beds: -25 to -21 dB. Use one bed at a time. Layer a second only on tentpole beats.",
  "SFX vs music balance check: before writing, sanity-check that the SFX bus would not be inaudible after final mastering. If you cannot point to at least 3 cues in different sections that would clearly bump the loudness meter above the music alone, raise gains or reduce ducking under those cues.",
  "Captions, transcript, forced alignment, and visual timing are input context only. Do not time effects to caption boundaries by default. Tie cues to visual beats first, narration phrasing second, transcript word-by-word last.",
  "Return compact timestamp-only XML inside <sound_design> with layered <track> tags and self-closing <effect /> tags.",
].join("\n");

const DEFAULT_REVISION_PROMPT_TEMPLATE = "Revision notes: {{revisionNotes}}\nKeep the revised sound-design XML timestamp-only: no anchors, sceneId, captionId, scene references, or caption-boundary timing properties.";

function buildTopLevelSoundDesignPromptTemplate(planningBriefTemplate: string) {
  return [
    "You are handling the Plan Sound Design artifact for the Agent Dashboard short-form workflow.",
    "",
    "Write the final sound-design markdown artifact to this exact path:",
    "{{soundDesignPath}}",
    "",
    "Workflow context:",
    "- Project topic: {{topic}}",
    "- Selected hook: {{selectedHookTextOrFallback}}",
    "- Project directory: {{projectDir}}",
    "",
    "{{revisionNotesBlock}}",
    "Inputs you must read before writing:",
    "- XML script artifact: {{xmlScriptPath}}",
    "- Caption timing JSON: {{captionPlanPath}}",
    "- Visual timing/cut manifest JSON: {{sceneManifestPath}}",
    "- Visual beat map summary JSON: {{visualBeatMapJson}}",
    "- Word-level forced alignment data, if present under the XML script work directory",
    "",
    "Saved sound library JSON:",
    "{{soundLibraryJson}}",
    "",
    "Saved music library JSON:",
    "{{musicLibraryJson}}",
    "",
    "Dashboard planning instructions for this project:",
    planningBriefTemplate,
    "",
    "Artifact requirements:",
    "- Write YAML front matter first with title, status: needs review, date, agent: Scribe, and category: sound-design.",
    "- After the front matter, write raw <sound_design> XML only.",
    "- Use one <sound_design version=\"2\" duckingDb=\"...\" ambienceDuckingDb=\"...\" motionDuckingDb=\"...\" transientDuckingDb=\"...\" transientBusGainDb=\"...\" maxConcurrentOneShots=\"...\" musicDuckingDb=\"...\" musicEqCutDb=\"...\" musicEqFrequencyHz=\"...\" musicEqQ=\"...\" outputSampleRate=\"...\" outputChannels=\"...\" masterLoudnessTargetLufs=\"...\" masterTruePeakDb=\"...\"> root element.",
    "- Inside it, group layered audio lanes with <track id=\"...\" role=\"...\"> elements containing self-closing <effect /> cues.",
    "- Optional music structure: add <music_segments> before/after the SFX tracks, with self-closing <segment id=\"...\" trackId=\"saved-music-id\" start=\"seconds\" end=\"seconds\" gainDb=\"...\" fadeInMs=\"...\" fadeOutMs=\"...\" mood=\"...\" pacing=\"...\" rationale=\"...\" /> entries. Use absolute timestamps only.",
    "- Every effect must include id, type, and start=\"seconds\". Include end=\"seconds\" or duration=\"seconds\" for beds/risers/tails when useful.",
    "- Optional effect attrs: assetId, description, searchQuery, category, priority, gainDb, fadeInMs, fadeOutMs, groupId, frequencyBand, layerRole, stylePalette, literalness, rationale, overlap, musicDuckingDb, musicEqCutDb, musicEqFrequencyHz, musicEqQ, musicLowCutHz, musicHighCutHz.",
    "- The first hook music segment should strongly prefer a dramatic, high-tension, cinematic, or magnetic saved track/stinger/score bed that grabs attention. It can transition into calmer proof or instruction music after the hook.",
    "- Plan music gains in the -13.5 to -5.5 dB target range (gainDb is literal, no hidden multiplier): hook -8.5 to -6.5 dB; proof/build -9.5 to -7.5 dB; instruction -11.5 to -9.5 dB; climax/payoff -7.5 to -5.5 dB; resolution -10.5 to -8.5 dB. These values are about 2.5 dB louder than the prior baseline while keeping narration primary. Plan non-music SFX about 3 dB quieter than the prior baseline: impacts >= -9 dB, clicks/ticks/taps >= -10 dB, risers/whooshes >= -11 dB, ambience -25 to -21 dB; transients only need to sit about 1 dB above overlapping music and risers/whooshes may sit roughly even with it. musicDuckingDb -6 to -4. musicDuckingUnderTransientsDb -3 to -1 (it stacks per-cue).",
    "- Stay within hard caps for a 60-90s short: at most 18 ticks/clicks/taps and at most 30 total <effect/> cues. Each cue must name a specific visual or narration beat in its rationale.",
    "- Enforce asset rotation: no two consecutive cues of the same type may share the same assetId. Use the breadth of the library before reusing.",
    "- Enforce leave-silence: in any 6s window of active narration, at least one >= 1.5s gap must have no transient cue.",
    "- For tentpole beats (hook, thesis/reveal, mid-pivot, final payoff), plan a frequency-layered group with shared groupId covering low + mid + high, or mark the beat rationale=\"silence-for-contrast\".",
    "- Use whooshes only when the picture moves. If there is no visual motion, choose a tick, riser-tail, or silence instead.",
    "- Motion-graphic boundary rule: always add tasteful transition SFX when visuals transition from a nano-banana/generated image/static visual into a motion_graphic visual, and when transitioning from a motion_graphic visual back to a generated/static image. For motion_graphic-to-motion_graphic visual changes, transition SFX are optional and left to your editorial discretion.",
    "- Motion-graphic interior rule: never add your own non-music/non-ambience SFX inside the interior of motion_graphic scenes/segments. Music and ambience beds are fine. Boundary transition SFX around motion-graphic scene edges are explicitly allowed and should not be excluded.",
    "- Do not guess bars, text, cards, arrows, charts, or other motion-graphic internals. The dashboard renderer/resolver owns deterministic internal motion-graphic SFX because it knows template animation timings.",
    "- Risers must resolve into an impact, stinger, or music payoff within 100-300 ms of their end. A riser with no resolution is invalid.",
    "- Placement must be timestamp-only. Use captions, transcript, word-level forced alignment, and visual timing as inputs, but do not emit anchors, sceneId, captionId, caption tags, scene references, or caption-boundary timing properties in the XML.",
    "- Treat the visual beat map as first-class timing truth. Lock to scene cuts, reveals, zooms, camera moves, before/after comparisons, and graphic step-throughs before locking to narration words.",
    "- Use the saved library as the allowed source palette. Match library metadata (style palette, frequency band, layer role, literalness) when present.",
    "- Score the video like a film: write the emotional arc in the rationale of the first music segment, then use >= 2 music segments for videos > 20s (>= 3 for > 50s, >= 4 for > 75s).",
    "- Pick music tracks by metadata (mood, pacing, bpm, key, energy, emotionalArc, intensityCurve, bestSceneTypes, comparableTo). Never pick by trackId name guessing.",
    "- For every music segment transition, choose an intentional connector (crossfade, suckback + reverse riser, reverb-tail + gap + drop-in, or stinger landing) and name it in the segment rationale.",
    "- Reserve at least one music-driven climax beat where music gain is 2-3 dB louder than the surrounding segments and SFX support (not replace) the lift.",
    "- Write the updated artifact back to {{soundDesignPath}}, then read it back and verify the file exists and contains a <sound_design> root with <track> and <effect> entries.",
    "- If sound-design.md already exists, read it first. The regenerated Plan Sound Design XML must make meaningful body-level changes from the existing XML. Rewriting the same XML with only front matter/status/timestamp changes is invalid.",
    "- Compare only the sound-design XML body after YAML front matter. A timestamp/front-matter-only change is not a successful Plan Sound Design revision.",
    "- If an existing sound-design XML body is present, make a meaningful cue, timing, gain, track, rationale, or music-bed revision that changes the XML body while preserving valid schema and QA constraints.",
    "- If you cannot make a meaningful body change, fail clearly instead of writing the same body again.",
    "- Existing artifact body state: {{existingSoundDesignBodySummary}}",
  ].join("\n");
}

const DEFAULT_PROMPT_TEMPLATE = buildTopLevelSoundDesignPromptTemplate(DEFAULT_PLANNING_BRIEF_TEMPLATE);

const DEFAULT_SOUND_LIBRARY: ShortFormSoundLibraryEntry[] = [
  {
    id: "impact-soft-hit",
    name: "Soft hit",
    category: "Impact",
    semanticTypes: ["impact"],
    tags: ["subtle", "reveal", "punctuation"],
    stylePalettes: ["clean tech", "premium editorial"],
    frequencyBand: "mid",
    layerRoles: ["body", "punctuation"],
    literalness: "stylized",
    timingType: "point",
    defaultAnchor: "scene-start",
    defaultGainDb: -8,
    defaultFadeInMs: 0,
    defaultFadeOutMs: 180,
    recommendedUses: "Opening punctuation, reveal beats, subtle emphasis.",
    avoidUses: "Avoid stacking on every caption beat.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
  {
    id: "whoosh-subtle-transition",
    name: "Subtle transition whoosh",
    category: "Whoosh",
    semanticTypes: ["whoosh"],
    tags: ["transition", "movement", "clean"],
    stylePalettes: ["clean tech", "premium editorial"],
    frequencyBand: "high",
    layerRoles: ["motion", "air"],
    literalness: "stylized",
    timingType: "point",
    defaultAnchor: "scene-start",
    defaultGainDb: -10,
    defaultFadeInMs: 0,
    defaultFadeOutMs: 240,
    recommendedUses: "Visual transitions and motion accents.",
    avoidUses: "Avoid on static visuals or every sentence.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
  {
    id: "ambience-air-bed",
    name: "Air texture",
    category: "Ambience",
    semanticTypes: ["ambience"],
    tags: ["texture", "air", "light"],
    stylePalettes: ["premium editorial", "organic/nature"],
    frequencyBand: "high",
    layerRoles: ["air", "texture"],
    literalness: "emotional-metaphor",
    timingType: "bed",
    defaultAnchor: "scene-start",
    defaultGainDb: -21,
    defaultFadeInMs: 220,
    defaultFadeOutMs: 320,
    recommendedUses: "Quiet atmospheric support under sparse sections.",
    avoidUses: "Avoid when narration or music is already dense.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
];

export type ShortFormSoundSemanticType = "impact" | "riser" | "click" | "whoosh" | "ambience" | "music-riser" | "music-reverb-tail" | "mix-duck" | "mix-eq";
export type ShortFormSoundLibrarySemanticType = "impact" | "riser" | "click" | "whoosh" | "ambience";
export type ShortFormSoundTimingType = "point" | "bed" | "riser";
export type ShortFormSoundAnchor = "scene-start" | "scene-end" | "caption-start" | "caption-end" | "global-start" | "global-end";
export type ShortFormSoundFrequencyBand = "low" | "mid" | "high" | "full-range";
export type ShortFormSoundLiteralness = "literal" | "stylized" | "emotional-metaphor";

export interface ShortFormSoundLibraryEntry {
  id: string;
  name: string;
  category: string;
  semanticTypes: ShortFormSoundLibrarySemanticType[];
  tags: string[];
  stylePalettes?: string[];
  frequencyBand?: ShortFormSoundFrequencyBand;
  layerRoles?: string[];
  literalness?: ShortFormSoundLiteralness;
  timingType: ShortFormSoundTimingType;
  defaultAnchor: ShortFormSoundAnchor;
  defaultGainDb: number;
  defaultFadeInMs: number;
  defaultFadeOutMs: number;
  recommendedUses: string;
  avoidUses: string;
  notes: string;
  source?: string;
  license?: string;
  audioRelativePath?: string;
  audioUrl?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  anchorRatio?: number;
  waveformPeaks?: number[];
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormSoundDesignSettings {
  promptTemplate: string;
  revisionPromptTemplate: string;
  defaultDuckingDb: number;
  ambienceDuckingDb: number;
  motionDuckingDb: number;
  transientDuckingDb: number;
  transientBusGainDb: number;
  maxConcurrentOneShots: number;
  musicDuckingDb: number;
  musicDuckingUnderTransientsDb: number;
  musicEqCutDb: number;
  musicEqFrequencyHz: number;
  musicEqQ: number;
  musicLowCutHz: number;
  musicHighCutHz: number;
  outputSampleRate: number;
  outputChannels: number;
  masterLoudnessTargetLufs: number;
  masterTruePeakDb: number;
  library: ShortFormSoundLibraryEntry[];
}

export interface ShortFormSoundDesignTrackGroup {
  id: string;
  name: string;
  gainDb: number;
  notes?: string;
}

export type ShortFormSoundDesignTiming = ShortFormSoundTimingType;

export interface ShortFormSoundDesignEvent {
  id: string;
  type: ShortFormSoundSemanticType;
  assetId?: string;
  trackGroupId?: string;
  track?: string;
  startSeconds: number;
  endSeconds?: number;
  durationSeconds?: number;
  description?: string;
  searchQuery?: string;
  category?: string;
  priority?: "must-have" | "nice-to-have" | "optional";
  /** Legacy-only fields accepted for existing v1 artifacts. Do not emit for new sound-design XML. */
  anchor?: string;
  sceneId?: string;
  captionId?: string;
  offsetMs?: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  notes?: string;
  rationale?: string;
  overlap?: "allow" | "avoid" | "layered";
  groupId?: string;
  frequencyBand?: ShortFormSoundFrequencyBand;
  layerRole?: string;
  stylePalette?: string;
  literalness?: ShortFormSoundLiteralness;
  musicDuckingDb?: number;
  musicEqCutDb?: number;
  musicEqFrequencyHz?: number;
  musicEqQ?: number;
  musicLowCutHz?: number;
  musicHighCutHz?: number;
}

export interface ShortFormSoundDesignMix {
  defaultDuckingDb: number;
  ambienceDuckingDb: number;
  motionDuckingDb: number;
  transientDuckingDb: number;
  transientBusGainDb: number;
  maxConcurrentOneShots: number;
  musicDuckingDb: number;
  musicDuckingUnderTransientsDb: number;
  musicEqCutDb: number;
  musicEqFrequencyHz: number;
  musicEqQ: number;
  musicLowCutHz: number;
  musicHighCutHz: number;
  outputSampleRate: number;
  outputChannels: number;
  masterLoudnessTargetLufs: number;
  masterTruePeakDb: number;
}

export interface ShortFormSoundDesignArtifact {
  version: number;
  source: "generated" | "manual";
  createdAt: string;
  updatedAt: string;
  promptSnapshot?: string;
  notes?: string;
  mix?: ShortFormSoundDesignMix;
  trackGroups: ShortFormSoundDesignTrackGroup[];
  events: ShortFormSoundDesignEvent[];
}

export interface ShortFormSoundDesignSummary {
  exists: boolean;
  path: string;
  content: string;
  updatedAt?: string;
  artifact?: ShortFormSoundDesignArtifact | null;
  previewPath?: string;
  finalMixPath?: string;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizeFrequencyBand(value: unknown): ShortFormSoundFrequencyBand | undefined {
  return value === "low" || value === "mid" || value === "high" || value === "full-range" ? value : undefined;
}

function normalizeLiteralness(value: unknown): ShortFormSoundLiteralness | undefined {
  return value === "literal" || value === "stylized" || value === "emotional-metaphor" ? value : undefined;
}

function normalizeNumber(value: unknown, min: number, max: number, fallback: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const factor = 10 ** digits;
  const rounded = Math.round(parsed * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

function normalizeOptionalNumber(value: unknown, min: number, max: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  const factor = 10 ** digits;
  const rounded = Math.round(parsed * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

function normalizeLibrarySemanticTypes(value: unknown): ShortFormSoundLibrarySemanticType[] {
  const allowed = new Set<ShortFormSoundLibrarySemanticType>(["impact", "riser", "click", "whoosh", "ambience"]);
  const types = normalizeStringArray(value).filter((item): item is ShortFormSoundLibrarySemanticType => allowed.has(item as ShortFormSoundLibrarySemanticType));
  return types.length > 0 ? types : ["impact"];
}

function normalizeEventType(value: unknown): ShortFormSoundSemanticType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (normalized === "music-ducking" || normalized === "music-duck" || normalized === "ducking" || normalized === "near-silence") return "mix-duck";
  if (normalized === "music-eq" || normalized === "eq-carve") return "mix-eq";
  return normalized === "riser" || normalized === "click" || normalized === "whoosh" || normalized === "ambience" || normalized === "music-riser" || normalized === "music-reverb-tail" || normalized === "mix-duck" || normalized === "mix-eq"
    ? normalized
    : "impact";
}

function normalizeTimingType(value: unknown): ShortFormSoundTimingType {
  return value === "bed" || value === "riser" ? value : "point";
}

function normalizeAnchor(value: unknown): ShortFormSoundAnchor {
  return value === "scene-end"
    || value === "caption-start"
    || value === "caption-end"
    || value === "global-start"
    || value === "global-end"
    ? value
    : "scene-start";
}

function normalizeWaveformPeaks(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "number" && Number.isFinite(item) ? Math.max(0, Math.min(1, item)) : null))
        .filter((item): item is number => item !== null)
    : undefined;
}

function resolveSoundLibraryAbsolutePath(relativePath?: string) {
  if (!relativePath) return null;
  const baseDir = path.resolve(SOUND_LIBRARY_DIR);
  const absolutePath = path.resolve(baseDir, relativePath);
  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }
  return absolutePath;
}

function analyzeStoredWavFile(filePath: string, bucketCount = 240) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 44) return {};
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      return {};
    }

    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let blockAlign = 0;
    let dataOffset = 0;
    let dataSize = 0;

    for (let offset = 12; offset + 8 <= buffer.length;) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataStart = offset + 8;
      const chunkDataEnd = Math.min(buffer.length, chunkDataStart + chunkSize);

      if (chunkId === "fmt " && chunkDataEnd - chunkDataStart >= 16) {
        const audioFormat = buffer.readUInt16LE(chunkDataStart);
        if (audioFormat !== 1 && audioFormat !== 65534) {
          return {};
        }
        channels = buffer.readUInt16LE(chunkDataStart + 2);
        sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
        blockAlign = buffer.readUInt16LE(chunkDataStart + 12);
        bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
      } else if (chunkId === "data") {
        dataOffset = chunkDataStart;
        dataSize = Math.max(0, chunkDataEnd - chunkDataStart);
      }

      offset = chunkDataStart + chunkSize + (chunkSize % 2);
    }

    if (!channels || !sampleRate || !bitsPerSample || !blockAlign || !dataOffset || !dataSize) {
      return {};
    }

    const bytesPerSample = bitsPerSample / 8;
    if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
      return {};
    }

    const totalFrames = Math.floor(dataSize / blockAlign);
    const durationSeconds = totalFrames > 0
      ? Math.round((totalFrames / sampleRate) * 1000) / 1000
      : undefined;

    const safeBucketCount = Math.max(32, Math.min(512, Math.round(bucketCount)));
    const peaks = Array.from({ length: safeBucketCount }, () => 0);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const bucketIndex = Math.min(safeBucketCount - 1, Math.floor((frameIndex * safeBucketCount) / totalFrames));
      const frameOffset = dataOffset + frameIndex * blockAlign;
      let framePeak = 0;

      for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const sampleOffset = frameOffset + channelIndex * bytesPerSample;
        if (sampleOffset + bytesPerSample > buffer.length) {
          continue;
        }

        let normalizedSample = 0;
        if (bitsPerSample === 8) {
          normalizedSample = Math.abs(buffer.readUInt8(sampleOffset) - 128) / 128;
        } else if (bitsPerSample === 16) {
          normalizedSample = Math.abs(buffer.readInt16LE(sampleOffset)) / 32768;
        } else if (bitsPerSample === 24) {
          normalizedSample = Math.abs(buffer.readIntLE(sampleOffset, 3)) / 8388608;
        } else if (bitsPerSample === 32) {
          normalizedSample = Math.abs(buffer.readInt32LE(sampleOffset)) / 2147483648;
        } else {
          return {
            durationSeconds,
            sampleRate,
            channels,
          };
        }

        if (normalizedSample > framePeak) {
          framePeak = normalizedSample;
        }
      }

      if (framePeak > peaks[bucketIndex]) {
        peaks[bucketIndex] = framePeak;
      }
    }

    return {
      durationSeconds,
      sampleRate,
      channels,
      waveformPeaks: peaks.map((peak) => Math.round(Math.max(0, Math.min(1, peak)) * 1000) / 1000),
    };
  } catch {
    return {};
  }
}

export function getStoredSoundLibraryAudioAnalysis(relativePath?: string) {
  const absolutePath = resolveSoundLibraryAbsolutePath(relativePath);
  if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return {};
  }
  return analyzeStoredWavFile(absolutePath);
}

function buildSoundAudioUrl(relativePath?: string, cacheKey?: string) {
  if (!relativePath) return undefined;
  const encodedPath = relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/short-form-videos/settings/sound-library-files/${encodedPath}${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ""}`;
}

function normalizeLibraryEntry(candidate: Partial<ShortFormSoundLibraryEntry> | null | undefined, index: number): ShortFormSoundLibraryEntry {
  const now = new Date().toISOString();
  const uploadedAt = normalizeOptionalString(candidate?.uploadedAt);
  const updatedAt = normalizeOptionalString(candidate?.updatedAt) || uploadedAt;
  return {
    id: normalizeString(candidate?.id, `sound-${index + 1}`),
    name: normalizeString(candidate?.name, `Sound ${index + 1}`),
    category: normalizeString(candidate?.category, "Impact"),
    semanticTypes: normalizeLibrarySemanticTypes(candidate?.semanticTypes),
    tags: normalizeStringArray(candidate?.tags),
    stylePalettes: normalizeStringArray(candidate?.stylePalettes),
    frequencyBand: normalizeFrequencyBand(candidate?.frequencyBand),
    layerRoles: normalizeStringArray(candidate?.layerRoles),
    literalness: normalizeLiteralness(candidate?.literalness),
    timingType: normalizeTimingType(candidate?.timingType),
    defaultAnchor: normalizeAnchor(candidate?.defaultAnchor),
    defaultGainDb: normalizeNumber(candidate?.defaultGainDb, -36, 12, -6, 1),
    defaultFadeInMs: normalizeNumber(candidate?.defaultFadeInMs, 0, 10_000, 0, 0),
    defaultFadeOutMs: normalizeNumber(candidate?.defaultFadeOutMs, 0, 10_000, 180, 0),
    recommendedUses: normalizeString(candidate?.recommendedUses, ""),
    avoidUses: normalizeString(candidate?.avoidUses, ""),
    notes: normalizeString(candidate?.notes, ""),
    source: normalizeOptionalString(candidate?.source),
    license: normalizeOptionalString(candidate?.license),
    audioRelativePath: normalizeOptionalString(candidate?.audioRelativePath),
    durationSeconds: normalizeOptionalNumber(candidate?.durationSeconds, 0, 600, 3),
    sampleRate: normalizeOptionalNumber(candidate?.sampleRate, 1, 384000, 0),
    channels: normalizeOptionalNumber(candidate?.channels, 1, 64, 0),
    anchorRatio: normalizeOptionalNumber(candidate?.anchorRatio, 0, 1, 3) ?? 0,
    waveformPeaks: normalizeWaveformPeaks(candidate?.waveformPeaks),
    uploadedAt,
    createdAt: normalizeOptionalString(candidate?.createdAt) || now,
    updatedAt: updatedAt || now,
  };
}

function inferSoundLibraryStylePalettes(entry: ShortFormSoundLibraryEntry) {
  if (entry.stylePalettes && entry.stylePalettes.length > 0) return entry.stylePalettes;
  const key = `${entry.id} ${entry.name} ${entry.tags.join(" ")}`.toLowerCase();
  if (entry.category.toLowerCase() === "ambience") return ["premium editorial", "clean tech"];
  if (key.includes("wood") || key.includes("organic") || key.includes("field") || key.includes("wind")) return ["organic/nature", "premium editorial"];
  if (key.includes("trailer") || key.includes("cinematic") || key.includes("boom")) return ["cinematic trailer", "premium editorial"];
  if (key.includes("glitch") || key.includes("digital") || key.includes("ui") || key.includes("menu") || key.includes("button") || key.includes("sonar")) return ["clean tech", "premium editorial"];
  if (key.includes("cartoon") || key.includes("playful")) return ["playful ui", "premium editorial"];
  return ["premium editorial", "clean tech"];
}

function inferSoundLibraryFrequencyBand(entry: ShortFormSoundLibraryEntry) {
  if (entry.frequencyBand) return entry.frequencyBand;
  const key = `${entry.id} ${entry.name} ${entry.tags.join(" ")}`.toLowerCase();
  if (entry.category.toLowerCase() === "ambience") return key.includes("drone") || key.includes("bass") ? "low" : "high";
  if (key.includes("bass") || key.includes("boom") || key.includes("low")) return "low";
  if (key.includes("air") || key.includes("tick") || key.includes("click") || key.includes("spark") || key.includes("whip")) return "high";
  return entry.category.toLowerCase() === "impact" ? "mid" : "full-range";
}

function inferSoundLibraryLayerRoles(entry: ShortFormSoundLibraryEntry) {
  if (entry.layerRoles && entry.layerRoles.length > 0) return entry.layerRoles;
  const key = `${entry.id} ${entry.name} ${entry.tags.join(" ")}`.toLowerCase();
  if (entry.category.toLowerCase() === "ambience") return key.includes("drone") ? ["texture", "weight"] : ["air", "texture"];
  if (entry.category.toLowerCase() === "click") return ["tick", "transient"];
  if (entry.category.toLowerCase() === "whoosh") return ["motion", "air"];
  if (entry.category.toLowerCase() === "riser") return ["motion", "build"];
  if (key.includes("bass") || key.includes("boom")) return ["weight", "body"];
  if (key.includes("bright") || key.includes("stinger")) return ["sparkle", "punctuation"];
  return ["body", "punctuation"];
}

function inferSoundLibraryLiteralness(entry: ShortFormSoundLibraryEntry) {
  if (entry.literalness) return entry.literalness;
  if (entry.category.toLowerCase() === "ambience") return "emotional-metaphor";
  return entry.category.toLowerCase() === "click" ? "stylized" : "stylized";
}

function curateDefaultGainDb(entry: ShortFormSoundLibraryEntry) {
  const priorBaselineOverrides: Record<string, number> = {
    "click-ui-soft": -6.5,
    "click-ui-button-tight": -4.5,
    "click-glitch-tick": -5.5,
    "click-micro-accent": -5.5,
    "click-ui-round": -5.5,
    "click-button-snappy": -5,
    "click-menu-confirm": -5.5,
    "click-minimal-dry": -5.5,
    "click-sharp-accent": -4.5,
    "click-atonal-high": -5.5,
    "click-editorial-glass-tick": -3.5,
    "click-digital-blip-soft": -4.5,
    "click-low-mechanical-tick": -4.5,
    "click-wooden-tap-tight": -4,
    "impact-bright-stinger-hit": -4.5,
    "impact-pop-accent": -4.5,
    "impact-fx-hit-tight": -3.5,
    "impact-sonar-pulse-hit": -4.5,
    "impact-deep-bass-hit": -5,
    "riser-short-spark-uplift": -7.5,
    "riser-micro-reverse-tick": -7,
    "riser-mid-pulse-build": -7,
    "riser-noise-swell-soft": -8,
    "ambience-airy-texture-bed": -19,
    "ambience-soft-tonal-air-1": -18.5,
    "ambience-soft-tonal-air-2": -18.5,
  };
  const priorBaseline = priorBaselineOverrides[entry.id];
  return typeof priorBaseline === "number"
    ? Math.round((priorBaseline + QUIETER_SFX_GAIN_DB_SHIFT) * 10) / 10
    : entry.defaultGainDb;
}

function enrichLibraryEntry(entry: ShortFormSoundLibraryEntry) {
  const sourcePage = entry.source && /^https?:\/\//i.test(entry.source) ? entry.source : undefined;
  return {
    ...entry,
    stylePalettes: inferSoundLibraryStylePalettes(entry),
    frequencyBand: inferSoundLibraryFrequencyBand(entry),
    layerRoles: inferSoundLibraryLayerRoles(entry),
    literalness: inferSoundLibraryLiteralness(entry),
    defaultGainDb: curateDefaultGainDb(entry),
    source: entry.source || sourcePage,
  };
}

function normalizePromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_PROMPT_TEMPLATE;
  }

  return value.replace(/\r/g, "").trim();
}

function normalizeRevisionPromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_REVISION_PROMPT_TEMPLATE;
  }

  return value.replace(/\r/g, "").trim();
}

function normalizeSettings(candidate: Partial<ShortFormSoundDesignSettings> | null | undefined): ShortFormSoundDesignSettings {
  return {
    promptTemplate: normalizePromptTemplate(candidate?.promptTemplate),
    revisionPromptTemplate: normalizeRevisionPromptTemplate(candidate?.revisionPromptTemplate),
    defaultDuckingDb: normalizeNumber(candidate?.defaultDuckingDb, -24, 0, -6, 1),
    ambienceDuckingDb: normalizeNumber(candidate?.ambienceDuckingDb, -24, 0, candidate?.defaultDuckingDb ?? -6, 1),
    motionDuckingDb: normalizeNumber(candidate?.motionDuckingDb, -24, 0, -2, 1),
    transientDuckingDb: normalizeNumber(candidate?.transientDuckingDb, -12, 6, 0, 1),
    transientBusGainDb: normalizeNumber(candidate?.transientBusGainDb, -12, 12, 5, 1),
    maxConcurrentOneShots: normalizeNumber(candidate?.maxConcurrentOneShots, 1, 8, 4, 0),
    musicDuckingDb: normalizeNumber(candidate?.musicDuckingDb, -24, 0, -6, 1),
    musicDuckingUnderTransientsDb: normalizeNumber(candidate?.musicDuckingUnderTransientsDb, -18, 0, -2, 1),
    musicEqCutDb: normalizeNumber(candidate?.musicEqCutDb, -18, 0, -3, 1),
    musicEqFrequencyHz: normalizeNumber(candidate?.musicEqFrequencyHz, 120, 8000, 1800, 0),
    musicEqQ: normalizeNumber(candidate?.musicEqQ, 0.1, 10, 1.1, 2),
    musicLowCutHz: normalizeNumber(candidate?.musicLowCutHz, 0, 500, 60, 0),
    musicHighCutHz: normalizeNumber(candidate?.musicHighCutHz, 0, 20000, 0, 0),
    outputSampleRate: normalizeNumber(candidate?.outputSampleRate, 22050, 192000, 48000, 0),
    outputChannels: normalizeNumber(candidate?.outputChannels, 1, 8, 2, 0),
    masterLoudnessTargetLufs: normalizeNumber(candidate?.masterLoudnessTargetLufs, -24, -8, -16, 1),
    masterTruePeakDb: normalizeNumber(candidate?.masterTruePeakDb, -6, -0.1, -1.5, 1),
    library: Array.isArray(candidate?.library) && candidate.library.length > 0
      ? candidate.library.map((entry, index) => enrichLibraryEntry(normalizeLibraryEntry(entry, index)))
      : DEFAULT_SOUND_LIBRARY.map((entry, index) => enrichLibraryEntry(normalizeLibraryEntry(entry, index))),
  };
}

export function getShortFormSoundLibraryDir() {
  return SOUND_LIBRARY_DIR;
}

export function getShortFormSoundDesignSettings(): ShortFormSoundDesignSettings {
  let parsed: Partial<ShortFormSoundDesignSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormSoundDesignSettings>;
    } catch {
      parsed = undefined;
    }
  }
  return normalizeSettings(parsed);
}

export function saveShortFormSoundDesignSettings(patch: Partial<ShortFormSoundDesignSettings>) {
  ensureDir(path.dirname(SETTINGS_PATH));
  const current = getShortFormSoundDesignSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    ...(patch.library ? { library: patch.library } : {}),
  });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function appendSoundLibraryUrls(settings: ShortFormSoundDesignSettings): ShortFormSoundDesignSettings {
  return {
    ...settings,
    library: settings.library.map((entry) => ({
      ...entry,
      ...(!entry.waveformPeaks || entry.waveformPeaks.length === 0 || !entry.durationSeconds || !entry.sampleRate || !entry.channels
        ? getStoredSoundLibraryAudioAnalysis(entry.audioRelativePath)
        : {}),
      audioUrl: buildSoundAudioUrl(entry.audioRelativePath, entry.updatedAt || entry.uploadedAt),
    })),
  };
}

function buildPromptVisualBeatMapJson(projectDir: string) {
  const manifestPath = path.join(projectDir, "scenes", "manifest.json");
  const fallbackScenePath = path.join(projectDir, "scene-images.json");
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        scenes?: Array<Record<string, unknown>>;
      };
      const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
      return JSON.stringify({
        sceneCount: scenes.length,
        cuts: scenes.map((scene) => ({
          index: normalizeNumber(scene.index, 1, 10_000, 1, 0),
          start: normalizeNumber(scene.start, 0, 10_000, 0, 3),
          end: normalizeNumber(scene.end, 0, 10_000, 0, 3),
          text: normalizeString(scene.text, ""),
          visualId: normalizeOptionalString(scene.visual_id),
          cameraMotion: normalizeOptionalString(scene.camera_motion),
        })),
      }, null, 2);
    }
    if (fs.existsSync(fallbackScenePath)) {
      const raw = JSON.parse(fs.readFileSync(fallbackScenePath, "utf-8")) as {
        scenes?: Array<Record<string, unknown>>;
      };
      const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
      return JSON.stringify({
        sceneCount: scenes.length,
        cuts: scenes.map((scene, index) => ({
          index: index + 1,
          start: normalizeNumber(scene.startTime, 0, 10_000, 0, 3),
          end: normalizeNumber(scene.endTime, 0, 10_000, 0, 3),
          text: normalizeString(scene.caption, ""),
        })),
      }, null, 2);
    }
  } catch {}
  return JSON.stringify({ sceneCount: 0, cuts: [] }, null, 2);
}

function getProjectDir(projectId: string) {
  return path.join(SHORT_FORM_VIDEOS_DIR, projectId);
}

export function getProjectSoundDesignPath(projectId: string) {
  return path.join(getProjectDir(projectId), "sound-design.json");
}

export function getProjectSoundDesignPreviewPath(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "sound-design-work", "preview", "sound-design-preview.wav");
}

export function getProjectSoundDesignFinalMixPath(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "sound-design-work", "final", "sound-design-final.wav");
}

function normalizeTrackGroup(candidate: Partial<ShortFormSoundDesignTrackGroup> | null | undefined, index: number): ShortFormSoundDesignTrackGroup {
  return {
    id: normalizeString(candidate?.id, `group-${index + 1}`),
    name: normalizeString(candidate?.name, `Track group ${index + 1}`),
    gainDb: normalizeNumber(candidate?.gainDb, -36, 12, 0, 1),
    notes: normalizeOptionalString(candidate?.notes),
  };
}

function normalizeArtifactEvent(candidate: Partial<ShortFormSoundDesignEvent> | null | undefined, index: number): ShortFormSoundDesignEvent {
  const type = normalizeEventType(candidate?.type);
  return {
    id: normalizeString(candidate?.id, `evt-${index + 1}`),
    type,
    trackGroupId: normalizeOptionalString(candidate?.trackGroupId),
    track: normalizeOptionalString(candidate?.track) || (type === "ambience" ? "ambience" : type === "riser" || type === "whoosh" ? "transitions" : "impacts"),
    assetId: normalizeString(candidate?.assetId, "") || undefined,
    startSeconds: normalizeNumber(candidate?.startSeconds, 0, 10_000, 0, 3),
    endSeconds: normalizeOptionalNumber(candidate?.endSeconds, 0, 10_000, 3),
    durationSeconds: normalizeOptionalNumber(candidate?.durationSeconds, 0.01, 10_000, 3),
    description: normalizeOptionalString(candidate?.description),
    searchQuery: normalizeOptionalString(candidate?.searchQuery),
    category: normalizeOptionalString(candidate?.category),
    priority: candidate?.priority === "must-have" || candidate?.priority === "nice-to-have" || candidate?.priority === "optional" ? candidate.priority : undefined,
    anchor: normalizeOptionalString(candidate?.anchor),
    sceneId: normalizeOptionalString(candidate?.sceneId),
    captionId: normalizeOptionalString(candidate?.captionId),
    offsetMs: normalizeOptionalNumber(candidate?.offsetMs, -20_000, 20_000, 0),
    gainDb: normalizeOptionalNumber(candidate?.gainDb, -36, 12, 1),
    fadeInMs: normalizeOptionalNumber(candidate?.fadeInMs, 0, 10_000, 0),
    fadeOutMs: normalizeOptionalNumber(candidate?.fadeOutMs, 0, 10_000, 0),
    notes: normalizeOptionalString(candidate?.notes),
    rationale: normalizeOptionalString(candidate?.rationale),
    overlap: candidate?.overlap === "allow" || candidate?.overlap === "avoid" || candidate?.overlap === "layered" ? candidate.overlap : undefined,
    groupId: normalizeOptionalString(candidate?.groupId),
    frequencyBand: normalizeFrequencyBand(candidate?.frequencyBand),
    layerRole: normalizeOptionalString(candidate?.layerRole),
    stylePalette: normalizeOptionalString(candidate?.stylePalette),
    literalness: normalizeLiteralness(candidate?.literalness),
    musicDuckingDb: normalizeOptionalNumber(candidate?.musicDuckingDb, -24, 0, 1),
    musicEqCutDb: normalizeOptionalNumber(candidate?.musicEqCutDb, -18, 0, 1),
    musicEqFrequencyHz: normalizeOptionalNumber(candidate?.musicEqFrequencyHz, 120, 8000, 0),
    musicEqQ: normalizeOptionalNumber(candidate?.musicEqQ, 0.1, 10, 2),
    musicLowCutHz: normalizeOptionalNumber(candidate?.musicLowCutHz, 0, 500, 0),
    musicHighCutHz: normalizeOptionalNumber(candidate?.musicHighCutHz, 0, 20000, 0),
  };
}

function buildDefaultTrackGroups(settings: ShortFormSoundDesignSettings): ShortFormSoundDesignTrackGroup[] {
  const fromLibrary = Array.from(new Set(settings.library.map((entry) => normalizeString(entry.category, "")).filter(Boolean))).slice(0, 4);
  const labels = fromLibrary.length > 0 ? fromLibrary : ["Impacts", "Transitions", "Ambience"];
  return labels.map((label, index) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `group-${index + 1}`,
    name: label,
    gainDb: 0,
  }));
}

export function resolveSoundDesignArtifact(value: unknown, settings = getShortFormSoundDesignSettings()): ShortFormSoundDesignArtifact {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ShortFormSoundDesignArtifact>
    : {};
  const now = new Date().toISOString();
  const trackGroups = Array.isArray(candidate.trackGroups)
    ? candidate.trackGroups.map((group, index) => normalizeTrackGroup(group, index))
    : buildDefaultTrackGroups(settings);
  return {
    version: normalizeNumber(candidate.version, 1, 99, 1, 0),
    source: candidate.source === "manual" ? "manual" : "generated",
    createdAt: normalizeString(candidate.createdAt, now),
    updatedAt: normalizeString(candidate.updatedAt, now),
    promptSnapshot: normalizeOptionalString(candidate.promptSnapshot),
    notes: normalizeOptionalString(candidate.notes),
    mix: {
      defaultDuckingDb: normalizeNumber(candidate.mix?.defaultDuckingDb, -24, 0, settings.defaultDuckingDb, 1),
      ambienceDuckingDb: normalizeNumber(candidate.mix?.ambienceDuckingDb, -24, 0, settings.ambienceDuckingDb, 1),
      motionDuckingDb: normalizeNumber(candidate.mix?.motionDuckingDb, -24, 0, settings.motionDuckingDb, 1),
      transientDuckingDb: normalizeNumber(candidate.mix?.transientDuckingDb, -12, 6, settings.transientDuckingDb, 1),
      transientBusGainDb: normalizeNumber(candidate.mix?.transientBusGainDb, -12, 12, settings.transientBusGainDb, 1),
      maxConcurrentOneShots: normalizeNumber(candidate.mix?.maxConcurrentOneShots, 1, 8, settings.maxConcurrentOneShots, 0),
      musicDuckingDb: normalizeNumber(candidate.mix?.musicDuckingDb, -24, 0, settings.musicDuckingDb, 1),
      musicDuckingUnderTransientsDb: normalizeNumber(candidate.mix?.musicDuckingUnderTransientsDb, -18, 0, settings.musicDuckingUnderTransientsDb, 1),
      musicEqCutDb: normalizeNumber(candidate.mix?.musicEqCutDb, -18, 0, settings.musicEqCutDb, 1),
      musicEqFrequencyHz: normalizeNumber(candidate.mix?.musicEqFrequencyHz, 120, 8000, settings.musicEqFrequencyHz, 0),
      musicEqQ: normalizeNumber(candidate.mix?.musicEqQ, 0.1, 10, settings.musicEqQ, 2),
      musicLowCutHz: normalizeNumber(candidate.mix?.musicLowCutHz, 0, 500, settings.musicLowCutHz, 0),
      musicHighCutHz: normalizeNumber(candidate.mix?.musicHighCutHz, 0, 20000, settings.musicHighCutHz, 0),
      outputSampleRate: normalizeNumber(candidate.mix?.outputSampleRate, 22050, 192000, settings.outputSampleRate, 0),
      outputChannels: normalizeNumber(candidate.mix?.outputChannels, 1, 8, settings.outputChannels, 0),
      masterLoudnessTargetLufs: normalizeNumber(candidate.mix?.masterLoudnessTargetLufs, -24, -8, settings.masterLoudnessTargetLufs, 1),
      masterTruePeakDb: normalizeNumber(candidate.mix?.masterTruePeakDb, -6, -0.1, settings.masterTruePeakDb, 1),
    },
    trackGroups,
    events: Array.isArray(candidate.events)
      ? candidate.events.map((event, index) => normalizeArtifactEvent(event, index))
      : [],
  };
}

export function getProjectSoundDesign(projectId: string): ShortFormSoundDesignSummary {
  const filePath = getProjectSoundDesignPath(projectId);
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      path: filePath,
      content: "",
      previewPath: getProjectSoundDesignPreviewPath(projectId),
      finalMixPath: getProjectSoundDesignFinalMixPath(projectId),
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let artifact: ShortFormSoundDesignArtifact | null = null;
  try {
    artifact = resolveSoundDesignArtifact(JSON.parse(content));
  } catch {
    artifact = null;
  }

  return {
    exists: true,
    path: filePath,
    content,
    updatedAt: fs.statSync(filePath).mtime.toISOString(),
    artifact,
    previewPath: getProjectSoundDesignPreviewPath(projectId),
    finalMixPath: getProjectSoundDesignFinalMixPath(projectId),
  };
}

export function writeProjectSoundDesign(projectId: string, artifact: ShortFormSoundDesignArtifact) {
  const filePath = getProjectSoundDesignPath(projectId);
  ensureDir(path.dirname(filePath));
  const normalized = resolveSoundDesignArtifact(artifact);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

export function renderShortFormSoundDesignPrompt(template: string, values: Record<string, string | undefined>) {
  const withConditionalRevisionNotesBlock = template.replace(
    /^[ \t]*\{\{\s*revisionNotesBlock\s*\}\}[ \t]*\n?/gm,
    values.revisionNotesBlock ? `${values.revisionNotesBlock}\n` : ""
  );

  return withConditionalRevisionNotesBlock.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

function compactPromptText(value: string | undefined, maxLength = 220) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trimEnd()}...` : normalized;
}

function compactPromptStringArray(value: string[] | undefined, maxItems = 6) {
  const items = (value || []).map((item) => item.trim()).filter(Boolean);
  return items.length > maxItems ? items.slice(0, maxItems) : items;
}

function buildPromptSoundLibraryJson(library: ShortFormSoundLibraryEntry[]) {
  return JSON.stringify(library.map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    semanticTypes: compactPromptStringArray(entry.semanticTypes),
    tags: compactPromptStringArray(entry.tags, 8),
    stylePalettes: compactPromptStringArray(entry.stylePalettes),
    frequencyBand: entry.frequencyBand,
    layerRoles: compactPromptStringArray(entry.layerRoles),
    literalness: entry.literalness,
    timingType: entry.timingType,
    defaultGainDb: entry.defaultGainDb,
    defaultFadeInMs: entry.defaultFadeInMs,
    defaultFadeOutMs: entry.defaultFadeOutMs,
    durationSeconds: entry.durationSeconds,
    sourceSyncPointRatio: entry.anchorRatio,
    hasSavedAudio: Boolean(entry.audioRelativePath),
    recommendedUses: compactPromptText(entry.recommendedUses),
    avoidUses: compactPromptText(entry.avoidUses),
    notes: compactPromptText(entry.notes),
  })), null, 2);
}

function buildPromptMusicLibraryJson() {
  const settings = getShortFormVideoRenderSettings();
  return JSON.stringify(settings.musicTracks.map((track) => ({
    id: track.id,
    name: track.name,
    mood: track.mood,
    pacing: track.pacing,
    bpm: track.bpm,
    key: track.key,
    energy: track.energy,
    emotionalArc: track.emotionalArc,
    intensityCurve: track.intensityCurve,
    tags: track.tags,
    recommendedSections: track.recommendedSections,
    bestSceneTypes: track.bestSceneTypes,
    comparableTo: track.comparableTo,
    transitionInPattern: track.transitionInPattern,
    transitionOutPattern: track.transitionOutPattern,
    loopFriendly: track.loopFriendly,
    durationSeconds: track.durationSeconds ?? track.generatedDurationSeconds,
    notes: compactPromptText(track.notes),
    hasSavedAudio: Boolean(track.generatedAudioRelativePath),
  })), null, 2);
}

export function buildShortFormSoundDesignPrompt(projectId: string, options: {
  topic?: string;
  selectedHook?: string;
  revisionNotes?: string;
}) {
  const settings = getShortFormSoundDesignSettings();
  const projectDir = getProjectDir(projectId);
  const soundDesignPath = path.join(projectDir, "sound-design.md");
  const xmlScriptPath = path.join(projectDir, "xml-script.md");
  const captionPlanPath = path.join(projectDir, "output", "xml-script-work", "captions", "caption-sections.json");
  const sceneManifestPath = fs.existsSync(path.join(projectDir, "scenes", "manifest.json"))
    ? path.join(projectDir, "scenes", "manifest.json")
    : path.join(projectDir, "scene-images.json");
  const selectedHookText = options.selectedHook?.trim() || "No selected hook yet";
  const revisionNotes = options.revisionNotes?.trim() || "";
  const revisionNotesBlock = revisionNotes
    ? renderShortFormSoundDesignPrompt(settings.revisionPromptTemplate, {
        revisionNotes,
        soundDesignPath,
      })
    : undefined;
  let existingSoundDesignBody = "";
  if (fs.existsSync(soundDesignPath)) {
    try {
      existingSoundDesignBody = extractBody(
        fs.readFileSync(soundDesignPath, "utf-8"),
      ).trim();
    } catch {
      existingSoundDesignBody = "";
    }
  }

  return renderShortFormSoundDesignPrompt(settings.promptTemplate, {
    topic: options.topic?.trim() || "Untitled short-form video",
    selectedHook: selectedHookText,
    selectedHookTextOrFallback: selectedHookText,
    revisionNotes,
    revisionNotesBlock,
    projectId,
    projectDir,
    soundDesignPath,
    xmlScriptPath,
    captionPlanPath,
    sceneManifestPath,
    visualBeatMapJson: buildPromptVisualBeatMapJson(projectDir),
    soundLibraryJson: buildPromptSoundLibraryJson(settings.library),
    musicLibraryJson: buildPromptMusicLibraryJson(),
    existingSoundDesignBodySummary: existingSoundDesignBody
      ? `The current artifact body is ${existingSoundDesignBody.length} characters; your saved body must differ from it.`
      : "No previous sound-design XML body was found; write the initial complete XML body.",
  });
}

export function generateShortFormSoundDesign(projectId: string, options: {
  topic?: string;
  selectedHook?: string;
  revisionNotes?: string;
}): ShortFormSoundDesignArtifact {
  const settings = getShortFormSoundDesignSettings();
  const now = new Date().toISOString();
  return resolveSoundDesignArtifact({
    version: 1,
    source: "generated",
    createdAt: now,
    updatedAt: now,
    promptSnapshot: buildShortFormSoundDesignPrompt(projectId, options),
    notes: options.revisionNotes?.trim() || undefined,
    mix: {
      defaultDuckingDb: settings.defaultDuckingDb,
      ambienceDuckingDb: settings.ambienceDuckingDb,
      motionDuckingDb: settings.motionDuckingDb,
      transientDuckingDb: settings.transientDuckingDb,
      transientBusGainDb: settings.transientBusGainDb,
      maxConcurrentOneShots: settings.maxConcurrentOneShots,
      musicDuckingDb: settings.musicDuckingDb,
      musicEqCutDb: settings.musicEqCutDb,
      musicEqFrequencyHz: settings.musicEqFrequencyHz,
      musicEqQ: settings.musicEqQ,
      musicLowCutHz: settings.musicLowCutHz,
      musicHighCutHz: settings.musicHighCutHz,
      outputSampleRate: settings.outputSampleRate,
      outputChannels: settings.outputChannels,
      masterLoudnessTargetLufs: settings.masterLoudnessTargetLufs,
      masterTruePeakDb: settings.masterTruePeakDb,
    },
    trackGroups: buildDefaultTrackGroups(settings),
    events: [],
  }, settings);
}

export function resolveAudioMixInputs(projectId: string, artifact?: ShortFormSoundDesignArtifact) {
  const resolvedArtifact = artifact || getProjectSoundDesign(projectId).artifact || undefined;
  const settings = getShortFormSoundDesignSettings();
  const libraryById = new Map(settings.library.map((entry) => [entry.id, entry]));
  return (resolvedArtifact?.events || []).map((event) => {
    const match = event.trackGroupId ? libraryById.get(event.trackGroupId) : undefined;
    return {
      eventId: event.id,
      trackGroupId: event.trackGroupId,
      audioRelativePath: match?.audioRelativePath,
    };
  });
}
