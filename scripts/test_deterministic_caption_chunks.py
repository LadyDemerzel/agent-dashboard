import importlib.util
import sys
from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).with_name("deterministic_caption_chunks.py")
SPEC = importlib.util.spec_from_file_location("deterministic_caption_chunks", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class DeterministicCaptionChunkTests(unittest.TestCase):
    def build_captions(self, script_text: str, max_words: int = 6):
        captions, _ = MODULE.build_captions(script_text, {"items": []}, max_words)
        return captions

    def build_text_chunks(self, script_text: str, max_words: int = 6) -> list[str]:
        return [caption.text for caption in self.build_captions(script_text, max_words)]

    def assert_hard_cap(self, script_text: str, max_words: int) -> None:
        captions = self.build_captions(script_text, max_words)
        self.assertTrue(captions)
        self.assertTrue(all(caption.word_count <= max_words for caption in captions), captions)

    def test_respects_hard_cap_for_previous_punctuation_overflow_case(self) -> None:
        script_text = "the first filter people run on you, and how it changes opportunity"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(
            chunks,
            [
                "the first filter people run on",
                "you, and how it changes opportunity",
            ],
        )

    def test_keeps_attached_phrase_when_it_fits_under_cap(self) -> None:
        chunks = self.build_text_chunks(
            "the first filter people run on you, and how it changes opportunity",
            max_words=8,
        )
        self.assertEqual(
            chunks,
            [
                "the first filter people run on you",
                "and how it changes opportunity",
            ],
        )

    def test_uses_best_compliant_boundary_for_short_attached_phrase(self) -> None:
        script_text = "And the same bias follows you to work"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(chunks, ["And the same bias", "follows you to work"])

    def test_avoids_trailing_subordinating_conjunction_when_clause_fits(self) -> None:
        script_text = "Make your face more symmetrical if you want more chances"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(chunks, ["Make your face more symmetrical", "if you want more chances"])

    def test_avoids_trailing_conjunction_when_other_break_fits(self) -> None:
        script_text = "was also judged more intelligent and more trustworthy"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(chunks, ["was also judged", "more intelligent and more trustworthy"])

    def test_keeps_numeric_phrase_together_when_it_fits(self) -> None:
        script_text = "grads found attractive people were 52.4 percent more"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(chunks, ["grads found attractive people were", "52.4 percent more"])

    def test_preserves_infinitive_object_phrase_when_it_fits_under_cap(self) -> None:
        chunks = self.build_text_chunks(
            "You are 30 percent more likely to land prestigious roles",
            max_words=10,
        )
        self.assertEqual(chunks, ["You are 30 percent more likely to land prestigious roles"])

    def test_hard_cap_holds_for_previous_attached_phrase_overflow_case(self) -> None:
        script_text = "This matters more than you think because the first impression shapes everything after it"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(
            chunks,
            [
                "This matters more than you think",
                "because the first impression shapes everything",
                "after it",
            ],
        )

    def test_prefers_numeric_lead_in_before_number_phrase_when_sentence_overflows(self) -> None:
        script_text = "You are 30 percent more likely to land prestigious roles if your face looks rested"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(
            chunks,
            [
                "You are 30 percent more likely",
                "to land prestigious roles",
                "if your face looks rested",
            ],
        )

    def test_prefers_clause_boundary_over_trailing_conjunction_in_middle_caption(self) -> None:
        script_text = "People trust you more when your face looks healthy and your posture stays open"
        self.assert_hard_cap(script_text, 6)
        chunks = self.build_text_chunks(script_text, max_words=6)
        self.assertEqual(
            chunks,
            [
                "People trust you more",
                "when your face looks healthy",
                "and your posture stays open",
            ],
        )

    def test_does_not_enforce_one_second_caption_minimum(self) -> None:
        captions, _ = MODULE.build_captions(
            "Quick line",
            {
                "items": [
                    {"text": "Quick", "start_time": 0.0, "end_time": 0.1},
                    {"text": "line", "start_time": 0.1, "end_time": 0.32},
                ]
            },
            6,
        )
        self.assertEqual(len(captions), 1)
        self.assertLess(captions[0].end - captions[0].start, 1.0)
        self.assertAlmostEqual(captions[0].end, 0.32, places=3)


if __name__ == "__main__":
    unittest.main()
