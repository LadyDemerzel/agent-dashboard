#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import types
from pathlib import Path


SKILL_SCRIPT = Path(
    "/Users/ittaisvidler/.openclaw/skills/xml-scene-images/scripts/generate_from_xml.py"
)
REPO_ROOT = Path(__file__).resolve().parents[1]
SETTINGS_VIEW = REPO_ROOT / "src/components/short-form-video/ShortFormVideoSettingsView.tsx"
STAGE_WORKER = REPO_ROOT / "scripts/short-form-stage-worker.mjs"


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_skill_module():
    if "PIL" not in sys.modules:
        pil_module = types.ModuleType("PIL")
        sys.modules["PIL"] = pil_module
        for name in ("Image", "ImageDraw", "ImageFont", "ImageOps"):
            submodule = types.ModuleType(f"PIL.{name}")
            setattr(pil_module, name, submodule)
            sys.modules[f"PIL.{name}"] = submodule

    spec = importlib.util.spec_from_file_location("xml_scene_images_generate", SKILL_SCRIPT)
    assert_true(spec is not None and spec.loader is not None, "Could not load XML scene image generator module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def build_scene(module, *, based_on_image_id: str | None = None):
    return module.Scene(
        index=1,
        duration=None,
        text="Jawline posture reset",
        image_prompt="Single side-profile portrait showing improved neck alignment.",
        reference_previous_scene_image=False,
        camera_motion=module.CameraMotion(),
        character_driven=False,
        image_id="jawline-reset",
        based_on_image_id=based_on_image_id,
        visual_id="visual-1",
    )


def render_prompt(
    module,
    templates,
    *,
    extra_direction: str = "",
    extra_references_text: str = "",
    based_on_image_id: str | None = None,
    based_on_reference_attachment_index: int | None = None,
) -> str:
    return module.scene_prompt(
        build_scene(module, based_on_image_id=based_on_image_id),
        "Facial posture reset",
        "Your jawline changes when posture changes.",
        templates,
        header_percent=28,
        common_constraints="",
        style_extra="Clean charcoal illustration.",
        extra_references_text=extra_references_text,
        extra_direction=extra_direction,
        based_on_reference_attachment_index=based_on_reference_attachment_index,
        use_revision_template=True,
        character_driven=False,
        character_reference_available=False,
    )


def verify_templates(module) -> None:
    templates = module.load_prompt_templates(None)
    assert_true("imageGenerationTemplate" in templates, "Image generation template should exist")
    assert_true("imageRevisionTemplate" not in templates, "Image revision template should be removed")
    assert_true("commonImageInstructionsTemplate" not in templates, "Common image instructions template should be removed")
    assert_true("{{commonImageInstructions}}" not in templates["imageGenerationTemplate"], "Default generation template should inline common instructions")
    assert_true("{{imageRevisionInstructions}}" not in templates["imageGenerationTemplate"], "Default generation template should not expose revision instructions")
    assert_true("{{imageDescription}}" in templates["imageGenerationTemplate"], "Default generation template should expose image description")
    assert_true("{{basedOnReferenceInstructions}}" in templates["imageGenerationTemplate"], "Default generation template should keep basedOn reference routing editable")
    assert_true("{{extraReferencesInstructions}}" in templates["imageGenerationTemplate"], "Default generation template should keep extra references editable")
    assert_true("Additional per-style art direction" in templates["imageGenerationTemplate"], "Common style instructions should be inlined")

    settings_view_source = SETTINGS_VIEW.read_text(encoding="utf-8")
    for removed_text in (
        "Image revision template",
        "Common image instructions template",
        "{{commonImageInstructions}}",
        "{{imageRevisionInstructions}}",
    ):
        assert_true(removed_text not in settings_view_source, f"Settings UI should not expose {removed_text}")

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(
            {
                "commonImageInstructionsTemplate": "Shared rule {{basedOnReferenceInstructions}} and {{styleInstructions}}.",
                "imageGenerationTemplate": "Image description: {{assetPrompt}}.\n\n{{commonImageInstructions}}\n\n{{extraReferences}}",
                "imageRevisionTemplate": "Revision direction: {{extraDirection}}.",
            },
            handle,
        )
        legacy_template_path = handle.name
    try:
        legacy_templates = module.load_prompt_templates(legacy_template_path)
    finally:
        Path(legacy_template_path).unlink(missing_ok=True)
    assert_true("imageRevisionTemplate" not in legacy_templates, "Legacy revision template should not remain after migration")
    assert_true("commonImageInstructionsTemplate" not in legacy_templates, "Legacy common template should not remain after migration")
    assert_true("{{assetPrompt}}" not in legacy_templates["imageGenerationTemplate"], "Legacy assetPrompt should normalize")
    assert_true("{{imageDescription}}" in legacy_templates["imageGenerationTemplate"], "Legacy assetPrompt should become imageDescription")
    assert_true("Shared rule {{basedOnReferenceInstructions}} and {{styleInstructions}}." in legacy_templates["imageGenerationTemplate"], "Legacy common template should be inlined into generation")

    clean_prompt = render_prompt(module, templates, extra_direction="Make the chin tuck clearer.")
    assert_true("Generate one reusable image asset" in clean_prompt, "Rerender should route through the generation template")
    assert_true("Revise one reusable generated image asset" not in clean_prompt, "Rerender should not use a revision template")
    assert_true("Image revision instructions:" not in clean_prompt, "Rerender notes should not be hidden prompt instructions")

    referenced_prompt = render_prompt(
        module,
        templates,
        extra_references_text="Additional attached reference images are provided. Use the lighting reference only for soft rim light.",
    )
    assert_true("Additional attached reference images are provided" in referenced_prompt, "Extra references should render when present")

    based_on_prompt = render_prompt(
        module,
        templates,
        based_on_image_id="source-profile",
        based_on_reference_attachment_index=2,
    )
    assert_true("Attached reference image 2 is the parent/base image" in based_on_prompt, "XML basedOn attachment should keep its prompt role")
    assert_true("source-profile" not in based_on_prompt, "Default basedOn prompt should not expose only the source asset id")


def verify_xml_prompt_update_and_generation_route(module) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        xml_path = tmp_path / "xml-script.md"
        xml_path.write_text(
            "\n".join(
                [
                    "---",
                    "status: needs review",
                    "---",
                    '<video version="2">',
                    "  <topic>Facial posture reset</topic>",
                    "  <script>Your jawline changes when posture changes.</script>",
                    "  <assets>",
                    '    <image id="base-profile" characterDriven="false"><prompt>Repeated profile prompt &amp; shared.</prompt></image>',
                    '    <image id="derived-profile" basedOn="base-profile" characterDriven="false"><prompt>Repeated profile prompt &amp; shared.</prompt></image>',
                    '    <image id="unused-profile" characterDriven="false"><prompt>Repeated profile prompt &amp; shared.</prompt></image>',
                    "  </assets>",
                    "  <timeline>",
                    '    <visual id="v1" label="Base visual" imageId="base-profile" />',
                    '    <visual id="v2" label="Derived visual" imageId="derived-profile" />',
                    '    <visual id="v3" label="Unused duplicate prompt visual" imageId="unused-profile" />',
                    "  </timeline>",
                    "</video>",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        env = os.environ.copy()
        env["SHORT_FORM_STAGE_WORKER_XML_PROMPT_UPDATE_TEST"] = "1"
        env["SCENE_INDEX"] = "1"
        env["VISUAL_ID"] = "v2"
        env["IMAGE_ID"] = "derived-profile"
        env["NEXT_IMAGE_PROMPT"] = 'Edited derived crop with a clearer chin tuck & angle <45>.\nKeep "quoted" cues and apostrophes.'
        update_result = subprocess.run(
            ["node", str(STAGE_WORKER), str(xml_path)],
            cwd=str(REPO_ROOT),
            env=env,
            text=True,
            capture_output=True,
            timeout=20,
        )
        assert_true(update_result.returncode == 0, f"XML prompt update failed\nstdout:\n{update_result.stdout}\nstderr:\n{update_result.stderr}")
        updated_xml = xml_path.read_text(encoding="utf-8")
        assert_true(updated_xml.count("<prompt>Repeated profile prompt &amp; shared.</prompt>") == 2, "Rerender prompt edit should leave duplicate non-target prompts unchanged")
        assert_true("Edited derived crop with a clearer chin tuck &amp; angle &lt;45&gt;." in updated_xml, "Rerender prompt edit should XML-escape special characters")
        assert_true("Keep \"quoted\" cues and apostrophes." in updated_xml, "Rerender prompt edit should preserve multiline prompt text")
        assert_true("Edited derived crop with a clearer chin tuck & angle <45>." not in updated_xml, "Rerender prompt edit should not write unsafe raw XML text")

        xml_for_generator = tmp_path / "runtime.xml"
        xml_for_generator.write_text(updated_xml.split("---", 2)[-1].strip() + "\n", encoding="utf-8")
        spec = module.parse_xml(xml_for_generator)
        assert_true(spec.scenes[0].image_prompt == "Repeated profile prompt & shared.", "Base parsed prompt should be unchanged")
        assert_true(spec.scenes[1].image_prompt == "Edited derived crop with a clearer chin tuck & angle <45>. Keep \"quoted\" cues and apostrophes.", "Target parsed prompt should use edited XML prompt")
        assert_true(spec.scenes[2].image_prompt == "Repeated profile prompt & shared.", "Non-target duplicate parsed prompt should be unchanged")

        calls = []
        original_run_generate_image = module.run_generate_image
        original_normalize = module.normalize_image_to_scene_canvas
        original_argv = sys.argv[:]
        original_api_key = os.environ.get("OPENROUTER_API_KEY")

        def fake_run_generate_image(generator_script, prompt, filename, *, model, resolution, aspect_ratio, input_images=None, force=False, max_attempts=3, retry_delay_seconds=5, context_label=None):
            Path(filename).write_text("fake image", encoding="utf-8")
            calls.append(
                {
                    "context_label": context_label,
                    "prompt": prompt,
                    "filename": str(filename),
                    "input_images": [str(path) for path in (input_images or [])],
                }
            )

        try:
            module.run_generate_image = fake_run_generate_image
            module.normalize_image_to_scene_canvas = lambda path: False
            os.environ["OPENROUTER_API_KEY"] = "verify-only"
            output_dir = tmp_path / "out"
            sys.argv = [
                "generate_from_xml.py",
                str(xml_for_generator),
                "--output-dir",
                str(output_dir),
                "--generator-script",
                sys.executable,
                "--only-scenes",
                "1",
                "2",
                "--force",
                "--skip-caption-overlay",
            ]
            module.main()
        finally:
            module.run_generate_image = original_run_generate_image
            module.normalize_image_to_scene_canvas = original_normalize
            sys.argv = original_argv
            if original_api_key is None:
                os.environ.pop("OPENROUTER_API_KEY", None)
            else:
                os.environ["OPENROUTER_API_KEY"] = original_api_key

        assert_true(len(calls) == 2, "basedOn rerender should generate the parent and target assets")
        base_call, derived_call = calls
        assert_true(base_call["input_images"] == [], "Base asset should not receive basedOn input")
        assert_true(base_call["filename"] in derived_call["input_images"], "Derived asset should receive parent image as basedOn input")
        assert_true("Generate one reusable image asset" in derived_call["prompt"], "Edited rerender should use the normal generation template")
        assert_true("Revise one reusable generated image asset" not in derived_call["prompt"], "Edited rerender should not use a revision template")
        assert_true("Image revision instructions:" not in derived_call["prompt"], "Edited prompt should not be treated as revision instructions")
        assert_true("Edited derived crop with a clearer chin tuck & angle <45>. Keep \"quoted\" cues and apostrophes." in derived_call["prompt"], "Edited XML prompt should drive generation")
        assert_true("Attached reference image 1 is the parent/base image" in derived_call["prompt"], "basedOn reference routing should continue working")


def main() -> None:
    module = load_skill_module()
    verify_templates(module)
    verify_xml_prompt_update_and_generation_route(module)
    print("Verified image prompt template rendering and XML prompt rerender updates.")


if __name__ == "__main__":
    main()
