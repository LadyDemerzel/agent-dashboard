import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR, type ShortFormStageKey } from "@/lib/short-form-videos";

export type ShortFormPromptKey =
  | "hooksGenerate"
  | "hooksMore"
  | "researchGenerate"
  | "researchRevise"
  | "scriptGenerate"
  | "scriptRevise"
  | "sceneImagesGenerate"
  | "sceneImagesRevise"
  | "videoGenerate"
  | "videoRevise";

export interface ShortFormPromptDefinition {
  key: ShortFormPromptKey;
  title: string;
  description: string;
  stage: "hooks" | ShortFormStageKey;
}

export type ShortFormWorkflowPrompts = Record<ShortFormPromptKey, string>;

export const SHORT_FORM_PROMPT_DEFINITIONS: ShortFormPromptDefinition[] = [
  {
    key: "hooksGenerate",
    title: "Hook generation",
    description: "Initial hook generation request sent to Scribe/content-hooks.",
    stage: "hooks",
  },
  {
    key: "hooksMore",
    title: "More hooks",
    description: "Additional hook generation when the user requests another batch.",
    stage: "hooks",
  },
  {
    key: "researchGenerate",
    title: "Research generation",
    description: "Initial research request sent to Oracle after a hook is selected.",
    stage: "research",
  },
  {
    key: "researchRevise",
    title: "Research revision",
    description: "Revision request sent to Oracle when research needs changes.",
    stage: "research",
  },
  {
    key: "scriptGenerate",
    title: "Script generation",
    description: "Initial XML script request sent to Scribe after research approval.",
    stage: "script",
  },
  {
    key: "scriptRevise",
    title: "Script revision",
    description: "Revision request sent to Scribe when the XML script needs changes.",
    stage: "script",
  },
  {
    key: "sceneImagesGenerate",
    title: "Scene image generation",
    description: "Initial storyboard image request handled by the direct dashboard xml-scene-images workflow.",
    stage: "scene-images",
  },
  {
    key: "sceneImagesRevise",
    title: "Scene image revision",
    description: "Revision request for the direct scene-image workflow, including single-scene change requests.",
    stage: "scene-images",
  },
  {
    key: "videoGenerate",
    title: "Final video generation",
    description: "Initial render request handled by the direct dashboard xml-scene-video workflow.",
    stage: "video",
  },
  {
    key: "videoRevise",
    title: "Final video revision",
    description: "Revision or regeneration request for the direct final-video workflow.",
    stage: "video",
  },
];

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_workflow-settings.json");

const DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS: ShortFormWorkflowPrompts = {
  hooksGenerate: [
    "You are working on a short-form video project in the Agent Dashboard web app.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Generate multiple short-form video hooks for this topic using the content-hooks skill.",
    "{{priorHooksBlock}}",
    "Produce 5 strong hook options optimized for vertical short-form video.",
    "Each option should be punchy, immediately visual, and no more than 10 words long.",
    "Keep hook punctuation minimal: no dashes, colons, semicolons, or periods. Apostrophes, quotes, and parentheses are okay if truly needed.",
    "{{hooksPayloadHint}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  hooksMore: [
    "You are working on a short-form video project in the Agent Dashboard web app.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Generate additional hooks. Extra direction from user: {{descriptionOrFallback}}",
    "{{priorHooksBlock}}",
    "Produce 5 strong hook options optimized for vertical short-form video.",
    "Each option should be punchy, immediately visual, and no more than 10 words long.",
    "Keep hook punctuation minimal: no dashes, colons, semicolons, or periods. Apostrophes, quotes, and parentheses are okay if truly needed.",
    "{{hooksPayloadHint}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  researchGenerate: [
    "Create research for a short-form video project.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Write concise but substantive research that will support a short-form video script.",
    "Write the finished artifact to disk — do not stop at a draft in chat.",
    "Save to: {{researchPath}}",
    "Use YAML front matter with title, status: needs review, date, agent: Oracle, tags: [short-form-video, research].",
    "The body should be markdown and should help Scribe write a multi-scene vertical-video XML script.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  researchRevise: [
    "Create research for a short-form video project.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Revise the existing research based on this feedback:\n{{notesOrFallback}}",
    "Update the on-disk artifact in place — do not stop at a draft in chat.",
    "Save to: {{researchPath}}",
    "Use YAML front matter with title, status: needs review, date, agent: Oracle, tags: [short-form-video, research].",
    "The body should be markdown and should help Scribe write a multi-scene vertical-video XML script.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  scriptGenerate: [
    "Create an XML short-form video script for the Agent Dashboard short-form workflow.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "Use the approved research and selected hook to generate the script in the updated full-script-first XML format, in the same general family as the write-facial-exercise-video-scripts skill.",
    "Write the finished script to disk — do not stop at a draft in chat.",
    "Save to: {{scriptPath}}",
    "Use YAML front matter with title, status: needs review, date, agent: Scribe, tags: [short-form-video, script, xml].",
    "The markdown body after front matter must be raw XML only.",
    "Required XML shape: <video><topic>...</topic><script>full spoken script here</script><scene referencePreviousSceneImage=\"true|false\" cameraPanX=\"-1..1\" cameraPanY=\"-1..1\" cameraZoom=\"0..1\" cameraShake=\"0..1\"><text>caption</text><image>visual direction</image></scene>...</video>. The scene attributes are optional and should stay sparse: use continuity or camera motion only when they clearly add meaning.",
    "Generate the FULL spoken script first, then derive scenes from it.",
    "Target total runtime roughly 25–50 seconds.",
    "The first sentence of <script> is the hook and must be 10 or fewer words, with minimal punctuation and no dashes, colons, semicolons, or periods. Apostrophes, quotes, and parentheses are okay if truly needed.",
    "Everything after the hook should read like normal spoken prose with punctuation and natural sentence flow.",
    "Prefer natural contractions throughout the full spoken <script> whenever they would sound normal in speech: use forms like \"can't\" instead of \"cannot\", \"it's\" instead of \"it is\", and \"you're\" instead of \"you are\" unless the full form is genuinely more natural in context.",
    "Use curiosity loops aggressively: open them early, keep them open as long as possible, and when one closes open another immediately so curiosity stays alive through the script.",
    "Vary sentence lengths so adjacent sentences do not feel mechanically similar.",
    "Scene <text> captions must be a lossless chunking of the full <script>: keep every spoken word in the same order, with no paraphrasing, summarizing, compression, or omission. The only allowed changes are splitting the text into scene-sized chunks of 10 or fewer words. Preserve apostrophes for contractions and preserve commas anywhere they occur inside the chunk. If you concatenate the scene <text> blocks back together, you should recover the full script text, including those apostrophes and in-chunk commas. Some spoken sentences may span multiple scenes.",
    "Each scene <text> must stay inside a single sentence boundary. A caption may be one chunk of a longer sentence or one whole short sentence, but it must never contain the end of one sentence plus the start of the next. If a sentence boundary occurs, the next sentence must begin in the next scene.",
    "The <script> content is the source of truth for TTS and forced alignment. Scene captions must be a faithful chunked projection of that same text, not an independent rewrite.",
    "Scene <image> descriptions must describe a single cohesive full-frame composition, not a layout or graphic treatment.",
    "Make each <image> materially more concrete than a vague concept sketch. In most scenes, specify the camera/viewpoint, subject facing direction, framing/crop (for example full body, three-quarter, waist-up, shoulders-up, or neck-up close-up), how close or zoomed-in the shot feels, and, when relevant, the subject's pose or body orientation relative to camera.",
    "Keep each <image> concise but visually decisive: usually one sentence or two short clauses describing one frame, not a long paragraph, shot list, or multiple separate compositions.",
    "Write each <image> as natural integrated scene direction: one believable environment or moment, subject embedded in the same scene, with any dark or charcoal background treated as the real environment and any top text-safe headroom implied as natural dark falloff or background continuation rather than a separate box or strip.",
    "Do NOT use <image> wording that nudges the art toward tiles, boxes, panels, split-screen, before/after comparisons, collages, mockups, title cards, posters, framed prints, inset cards, picture-in-picture, floating rectangles, or boxed anatomy callouts unless the user explicitly asks for that layout.",
    "Do NOT imply text inside the artwork. Avoid mentioning labels, signage, headers, title text, captions, annotations, callouts, UI chrome, overlays, posters, screen text, app windows, or readable words inside the generated image.",
    "If the script moment involves comparison, anatomy emphasis, or multiple ideas, express that inside one unified scene with pose, depth, lighting, props, or subtle integrated visual cues instead of separate panels or labeled overlays.",
    "Bad <image> direction examples: 'before and after split screen', 'poster with labels', 'title card above her face', 'three boxed comparison panels'. Good direction pattern: 'single full-frame side-profile portrait in a dark studio with subtle integrated posture cues and natural negative space fading darker near the top'.",
    "For any scene that should visually continue from the previous generated frame, set referencePreviousSceneImage=\"true\" on that <scene>. When you do that, write the current <image> as a continuation of the previous image context rather than a fully standalone reset.",
    "If the same recurring character appears across scenes, keep wardrobe continuity sensible and avoid gratuitous outfit changes. If a primary character reference is later supplied to scene generation, treat that reference outfit as the default persistent outfit unless a scene explicitly calls for a deliberate change.",
    "Treat camera motion as rare intentional seasoning, not default coverage. Most scenes should omit cameraPanX/cameraPanY/cameraZoom/cameraShake entirely unless motion adds meaning.",
    "Many consecutive motion-heavy scenes are usually jarring. Avoid stacking dramatic zooms or multiple motion-heavy scenes back to back unless there is a clear editorial reason.",
    "When a scene truly benefits from motion, set only the needed attributes explicitly and keep them subtle by default. A practical starting range is about -0.18 to 0.18 for pan, 0.00 to 0.10 for zoom, and 0.00 to 0.04 for shake; go beyond that only when the moment genuinely earns it.",
    "Good motion example: a single gentle push-in on the reveal scene. Bad motion pattern: repeated zoom-ins across nearly every scene just because motion is available.",
    "If a scene does not need previous-image continuity or custom motion, omit those attributes instead of filling them with noisy defaults.",
    "Approved research:\n{{approvedResearch}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  scriptRevise: [
    "Create an XML short-form video script for the Agent Dashboard short-form workflow.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "{{revisionInstructionLine}}",
    "Update the existing script on disk in place — do not stop at a draft in chat.",
    "Save to: {{scriptPath}}",
    "Use YAML front matter with title, status: needs review, date, agent: Scribe, tags: [short-form-video, script, xml].",
    "The markdown body after front matter must be raw XML only.",
    "Required XML shape: <video><topic>...</topic><script>full spoken script here</script><scene referencePreviousSceneImage=\"true|false\" cameraPanX=\"-1..1\" cameraPanY=\"-1..1\" cameraZoom=\"0..1\" cameraShake=\"0..1\"><text>caption</text><image>visual direction</image></scene>...</video>. The scene attributes are optional and should stay sparse: use continuity or camera motion only when they clearly add meaning.",
    "Keep the workflow full-script-first: revise the full spoken <script> first, then revise scene captions so they still derive from it.",
    "Target total runtime roughly 25–50 seconds unless the feedback clearly asks for something else.",
    "The first sentence of <script> is the hook and must stay within 10 or fewer words, with minimal punctuation and no dashes, colons, semicolons, or periods.",
    "Everything after the hook should remain natural spoken prose with punctuation, curiosity-loop structure, varied sentence lengths, and natural contractions where they would sound normal in speech.",
    "Scene <text> captions must remain a lossless chunking of the full <script>: keep every spoken word in the same order, with no paraphrasing, summarizing, compression, or omission. The only allowed changes are splitting the text into scene-sized chunks of 10 or fewer words. Preserve apostrophes for contractions and preserve commas anywhere they occur inside the chunk. If you concatenate the scene <text> blocks back together, you should recover the full script text, including those apostrophes and in-chunk commas.",
    "Each scene <text> must stay inside a single sentence boundary. A caption may be one chunk of a longer sentence or one whole short sentence, but it must never contain the end of one sentence plus the start of the next. If a sentence boundary occurs, the next sentence must begin in the next scene.",
    "The <script> content is the source of truth for TTS and forced alignment. Scene captions must remain a faithful chunked projection of that same text, not an independent rewrite.",
    "Scene <image> descriptions must continue to describe a single cohesive full-frame composition, not a layout or graphic treatment.",
    "Make each revised <image> materially more concrete than a vague concept sketch. In most scenes, specify the camera/viewpoint, subject facing direction, framing/crop (for example full body, three-quarter, waist-up, shoulders-up, or neck-up close-up), how close or zoomed-in the shot feels, and, when relevant, the subject's pose or body orientation relative to camera.",
    "Keep each revised <image> concise but visually decisive: usually one sentence or two short clauses describing one frame, not a long paragraph, shot list, or multiple separate compositions.",
    "Keep each <image> as natural integrated scene direction: one believable environment or moment, subject embedded in the same scene, with any dark or charcoal background treated as the real environment and any top text-safe headroom implied as natural dark falloff or background continuation rather than a separate box or strip.",
    "Do NOT revise <image> wording toward tiles, boxes, panels, split-screen, before/after comparisons, collages, mockups, title cards, posters, framed prints, inset cards, picture-in-picture, floating rectangles, or boxed anatomy callouts unless the user explicitly asks for that layout.",
    "Do NOT imply text inside the artwork. Avoid mentioning labels, signage, headers, title text, captions, annotations, callouts, UI chrome, overlays, posters, screen text, app windows, or readable words inside the generated image.",
    "If the script moment involves comparison, anatomy emphasis, or multiple ideas, express that inside one unified scene with pose, depth, lighting, props, or subtle integrated visual cues instead of separate panels or labeled overlays.",
    "Bad <image> direction examples: 'before and after split screen', 'poster with labels', 'title card above her face', 'three boxed comparison panels'. Good direction pattern: 'single full-frame side-profile portrait in a dark studio with subtle integrated posture cues and natural negative space fading darker near the top'.",
    "For any scene that should visually continue from the previous generated frame, set referencePreviousSceneImage=\"true\" on that <scene>. When you do that, write the current <image> as a continuation of the previous image context rather than a fully standalone reset.",
    "If the same recurring character appears across scenes, keep wardrobe continuity sensible and avoid gratuitous outfit changes. If a primary character reference is later supplied to scene generation, treat that reference outfit as the default persistent outfit unless a scene explicitly calls for a deliberate change.",
    "Treat camera motion as rare intentional seasoning, not default coverage. Most scenes should omit cameraPanX/cameraPanY/cameraZoom/cameraShake entirely unless motion adds meaning.",
    "Many consecutive motion-heavy scenes are usually jarring. Avoid stacking dramatic zooms or multiple motion-heavy scenes back to back unless there is a clear editorial reason.",
    "When a scene truly benefits from motion, set only the needed attributes explicitly and keep them subtle by default. A practical starting range is about -0.18 to 0.18 for pan, 0.00 to 0.10 for zoom, and 0.00 to 0.04 for shake; go beyond that only when the moment genuinely earns it.",
    "Good motion example: a single gentle push-in on the reveal scene. Bad motion pattern: repeated zoom-ins across nearly every scene just because motion is available.",
    "If a scene does not need previous-image continuity or custom motion, omit those attributes instead of filling them with noisy defaults.",
    "Approved research:\n{{approvedResearch}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  sceneImagesGenerate: [
    "Generate scene images for a short-form XML script using the xml-scene-images skill.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "Generate the scene-image set from the XML script.",
    "You must write the required review doc and manifest files to disk before finishing.",
    "Read script from: {{scriptPath}}",
    "CRITICAL IMAGE RULE: the generated art from Nano Banana / the image model must contain NO baked-in text, letters, subtitles, labels, UI chrome, or watermark. Captions are added separately later.",
    "CRITICAL COMPOSITION RULE: every scene image must feel like one unified full-frame composition, not a collage, inset card, framed print, mockup, split-panel, picture-in-picture, sticker cutout, or cropped foreground pasted onto a separate background.",
    "Do not generate white borders, paper frames, margins, boxed inserts, polaroid/card treatment, floating portrait rectangles, or separate top/bottom panels. The charcoal/dark background must belong to the same actual scene and continue naturally behind the subject.",
    "Preserve top caption-safe headroom by letting the real scene background continue upward into very dark negative space with a soft gradient / atmospheric falloff. Never interpret that safe area as a literal header, banner, title-card region, plaque, boxed strip, or other clean rectangular top block.",
    "Avoid any hard horizontal divider near the top. The background, lighting, haze, and texture should flow continuously through the full frame, with the upper region feeling like a natural extension of the same environment rather than a separate panel.",
    "If a scene direction implies comparison, anatomy emphasis, or multiple ideas, solve it inside one cohesive composition using lighting, pose, depth, or subtle integrated visual cues — not divider lines, before/after cards, side-by-side tiles, or framed sub-images.",
    "Use the XML <script> only as story context. Use each scene's <text> as the caption metadata for the manifest and preview overlay, not as text to render inside the generated artwork.",
    "Honor the XML continuity flag scene by scene: when a <scene> has referencePreviousSceneImage=\"true\", use the previous actual generated scene image as an additional reference input for that scene.",
    "Handle previous-scene continuity deterministically and safely: if a scene depends on the previous scene image, generate in dependency order and never guess at a missing previous reference.",
    "For single-scene revisions, if the requested scene uses referencePreviousSceneImage=\"true\", reuse the current previous scene image from disk when it exists; otherwise fall back cleanly and note that continuity context was unavailable instead of silently using a stale or unrelated image.",
    "If the selected style supplies a primary character reference, treat that character's visible outfit/wardrobe as part of the stable identity and preserve it across scene generation and revisions unless the XML scene direction explicitly calls for a change.",
    "Favor soft cohesive blending and full-bleed composition. The main subject should feel naturally embedded in the environment/background, with no harsh rectangular crop edges or pasted-on foreground look.",
    "Save a review document to: {{sceneDocPath}} with YAML front matter including status: needs review and a short markdown summary.",
    "Also save a strict JSON manifest to: {{sceneManifestPath}}",
    "Manifest shape: { \"scenes\": [ { \"id\": \"scene-1\", \"number\": 1, \"caption\": \"...\", \"image\": \"scenes/scene-1.png\", \"previewImage\": \"scenes/scene-1-captioned.png\", \"notes\": \"optional\" } ] }",
    "Validation rules: output valid JSON only with no markdown fences/comments/trailing commas; scenes must be an array; every scene needs a non-empty id, unique positive integer number, non-empty caption, and at least one relative project path in image or previewImage; notes is optional but must be a string if included.",
    "The previewImage should be the captioned preview. The image should be the clean scene image.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  sceneImagesRevise: [
    "Generate scene images for a short-form XML script using the xml-scene-images skill.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "Revise the scene images based on this feedback:\n{{notesOrFallback}}",
    "You must update the required review doc and manifest files on disk before finishing.",
    "Read script from: {{scriptPath}}",
    "CRITICAL IMAGE RULE: the generated art from Nano Banana / the image model must contain NO baked-in text, letters, subtitles, labels, UI chrome, or watermark. Captions are added separately later.",
    "CRITICAL COMPOSITION RULE: every scene image must feel like one unified full-frame composition, not a collage, inset card, framed print, mockup, split-panel, picture-in-picture, sticker cutout, or cropped foreground pasted onto a separate background.",
    "Do not generate white borders, paper frames, margins, boxed inserts, polaroid/card treatment, floating portrait rectangles, or separate top/bottom panels. The charcoal/dark background must belong to the same actual scene and continue naturally behind the subject.",
    "Preserve top caption-safe headroom by letting the real scene background continue upward into very dark negative space with a soft gradient / atmospheric falloff. Never interpret that safe area as a literal header, banner, title-card region, plaque, boxed strip, or other clean rectangular top block.",
    "Avoid any hard horizontal divider near the top. The background, lighting, haze, and texture should flow continuously through the full frame, with the upper region feeling like a natural extension of the same environment rather than a separate panel.",
    "If a scene direction implies comparison, anatomy emphasis, or multiple ideas, solve it inside one cohesive composition using lighting, pose, depth, or subtle integrated visual cues — not divider lines, before/after cards, side-by-side tiles, or framed sub-images.",
    "Use the XML <script> only as story context. Use each scene's <text> as the caption metadata for the manifest and preview overlay, not as text to render inside the generated artwork.",
    "Honor the XML continuity flag scene by scene: when a <scene> has referencePreviousSceneImage=\"true\", use the previous actual generated scene image as an additional reference input for that scene.",
    "Handle previous-scene continuity deterministically and safely: if a scene depends on the previous scene image, generate in dependency order and never guess at a missing previous reference.",
    "For single-scene revisions, if the requested scene uses referencePreviousSceneImage=\"true\", reuse the current previous scene image from disk when it exists; otherwise fall back cleanly and note that continuity context was unavailable instead of silently using a stale or unrelated image.",
    "If the selected style supplies a primary character reference, treat that character's visible outfit/wardrobe as part of the stable identity and preserve it across scene generation and revisions unless the XML scene direction explicitly calls for a change.",
    "Favor soft cohesive blending and full-bleed composition. The main subject should feel naturally embedded in the environment/background, with no harsh rectangular crop edges or pasted-on foreground look.",
    "Save a review document to: {{sceneDocPath}} with YAML front matter including status: needs review and a short markdown summary.",
    "Also save a strict JSON manifest to: {{sceneManifestPath}}",
    "Manifest shape: { \"scenes\": [ { \"id\": \"scene-1\", \"number\": 1, \"caption\": \"...\", \"image\": \"scenes/scene-1.png\", \"previewImage\": \"scenes/scene-1-captioned.png\", \"notes\": \"optional\" } ] }",
    "Validation rules: output valid JSON only with no markdown fences/comments/trailing commas; scenes must be an array; every scene needs a non-empty id, unique positive integer number, non-empty caption, and at least one relative project path in image or previewImage; notes is optional but must be a string if included.",
    "The previewImage should be the captioned preview. The image should be the clean scene image.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  videoGenerate: [
    "Generate the final short-form video using the xml-scene-video skill.",
    "Topic: {{topic}}",
    "Render the final vertical short-form video from the XML script and generated scene images.",
    "Use the updated xml-scene-video defaults explicitly instead of guessing: full-video Qwen3-TTS narration, transcript-driven Qwen3-ForcedAligner-0.6B timing against the known full script, and ACE-Step-1.5 instrumental background music when no music file is provided.",
    "Do not switch to macOS say unless Qwen fails and an emergency fallback is absolutely required. Qwen should be the intended path for this workflow.",
    "Use the skill's bundled generate_video.py workflow rather than rebuilding the ffmpeg/TTS/music pipeline ad hoc.",
    "Recommended command shape: uv run --with pillow python3 ~/.openclaw/skills/xml-scene-video/scripts/generate_video.py --xml {{scriptPath}} --images-dir {{sceneImagesDir}} --output {{finalVideoPath}} --work-dir {{videoWorkDir}} --tts-engine qwen --voice-speaker Aiden --voice-instruct \"Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.\" --ace-step-url http://127.0.0.1:8011 --music-prompt \"instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice\" --music-volume 0.38 --force",
    "Use the scene manifest to confirm scene ordering/captions, but assemble from the generated image files in {{sceneImagesDir}} using the uncaptioned assets for motion and caption overlays separately.",
    "Read any per-scene cameraPanX, cameraPanY, cameraZoom, and cameraShake attributes from the XML and apply them to the scene image motion only, not to the caption overlay layer.",
    "Camera motion is fully opt-in: if a cameraPanX/cameraPanY/cameraZoom/cameraShake attribute is omitted, do not apply that effect. If a scene omits all camera motion attributes, render it with no added camera motion.",
    "You must write both the playable video artifact and the review doc to disk before finishing.",
    "Read script from: {{scriptPath}}",
    "Read scene manifest from: {{sceneManifestPath}}",
    "Scene images directory: {{sceneImagesDir}}",
    "Working directory for generated intermediates: {{videoWorkDir}}",
    "Save the playable video to: {{finalVideoPath}}",
    "Save a markdown review document to: {{videoDocPath}} with YAML front matter including status: needs review and notes about what was generated. Mention that the default path used Qwen narration from the XML <script> plus ACE-Step instrumental music unless the request explicitly overrode that.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  videoRevise: [
    "Generate the final short-form video using the xml-scene-video skill.",
    "Topic: {{topic}}",
    "Revise or regenerate the final video based on this feedback:\n{{notesOrFallback}}",
    "Keep the updated xml-scene-video defaults explicit during the revision unless the feedback specifically requests something else: full-video Qwen3-TTS narration, transcript-driven Qwen3-ForcedAligner-0.6B timing against the known full script, and ACE-Step-1.5 instrumental background music when no music file is provided.",
    "Do not switch to macOS say unless Qwen fails and an emergency fallback is absolutely required. Qwen should be the intended path for this workflow.",
    "Use the skill's bundled generate_video.py workflow rather than rebuilding the ffmpeg/TTS/music pipeline ad hoc.",
    "Recommended command shape: uv run --with pillow python3 ~/.openclaw/skills/xml-scene-video/scripts/generate_video.py --xml {{scriptPath}} --images-dir {{sceneImagesDir}} --output {{finalVideoPath}} --work-dir {{videoWorkDir}} --tts-engine qwen --voice-speaker Aiden --voice-instruct \"Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.\" --ace-step-url http://127.0.0.1:8011 --music-prompt \"instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice\" --music-volume 0.38 --force",
    "Use the scene manifest to confirm scene ordering/captions, but assemble from the generated image files in {{sceneImagesDir}} using the uncaptioned assets for motion and caption overlays separately.",
    "Read any per-scene cameraPanX, cameraPanY, cameraZoom, and cameraShake attributes from the XML and apply them to the scene image motion only, not to the caption overlay layer.",
    "Camera motion is fully opt-in: if a cameraPanX/cameraPanY/cameraZoom/cameraShake attribute is omitted, do not apply that effect. If a scene omits all camera motion attributes, render it with no added camera motion.",
    "You must update both the playable video artifact and the review doc on disk before finishing.",
    "Read script from: {{scriptPath}}",
    "Read scene manifest from: {{sceneManifestPath}}",
    "Scene images directory: {{sceneImagesDir}}",
    "Working directory for generated intermediates: {{videoWorkDir}}",
    "Save the playable video to: {{finalVideoPath}}",
    "Save a markdown review document to: {{videoDocPath}} with YAML front matter including status: needs review and notes about what was generated. Mention whether the revision stayed on the default Qwen-from-<script> + ACE-Step path or intentionally overrode it.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
};

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function readStoredPrompts(): Partial<ShortFormWorkflowPrompts> {
  if (!fs.existsSync(SETTINGS_PATH)) return {};

  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormWorkflowPrompts>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getShortFormWorkflowPrompts(): ShortFormWorkflowPrompts {
  return {
    ...DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS,
    ...readStoredPrompts(),
  };
}

export function saveShortFormWorkflowPrompts(nextPrompts: Partial<ShortFormWorkflowPrompts>) {
  ensureSettingsDir();
  const current = getShortFormWorkflowPrompts();
  const merged = {
    ...current,
    ...nextPrompts,
  } satisfies ShortFormWorkflowPrompts;

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getShortFormPromptDefinitions() {
  return SHORT_FORM_PROMPT_DEFINITIONS;
}

export function renderShortFormPrompt(template: string, values: Record<string, string | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}
