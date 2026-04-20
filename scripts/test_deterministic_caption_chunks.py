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
                "the first filter people",
                "run on you",
                "and how it changes opportunity",
            ],
        )

    def test_forces_split_on_comma_even_when_sentence_fits_under_cap(self) -> None:
        chunks = self.build_text_chunks("Short clause, next clause.", max_words=6)
        self.assertEqual(chunks, ["Short clause", "next clause"])

    def test_forces_split_on_comma_even_for_single_word_lead_in(self) -> None:
        chunks = self.build_text_chunks("Well, maybe.", max_words=6)
        self.assertEqual(chunks, ["Well", "maybe"])

    def test_forces_split_on_sentence_end_when_parser_merges_sentences(self) -> None:
        chunks = self.build_text_chunks(
            "The second you force it, the dominant side steals the rep. Watch for the first little jump, then slow that side down.",
            max_words=4,
        )
        self.assertTrue(any(chunk.endswith("rep") for chunk in chunks), chunks)
        self.assertTrue(any(chunk.startswith("Watch") for chunk in chunks), chunks)
        self.assertFalse(any("rep. Watch" in chunk for chunk in chunks), chunks)
        rep_index = next(index for index, chunk in enumerate(chunks) if chunk.endswith("rep"))
        self.assertTrue(chunks[rep_index + 1].startswith("Watch"), chunks)

    def test_forces_split_on_sentence_end_even_when_full_span_fits_under_cap(self) -> None:
        chunks = self.build_text_chunks("Tiny win. Big shift.", max_words=6)
        self.assertEqual(chunks, ["Tiny win", "Big shift"])

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

    def test_preserves_commas_inside_numbers(self) -> None:
        chunks = self.build_text_chunks("alpha beta 1,000 people noticed a change quickly.", max_words=3)
        self.assertEqual(chunks, ["alpha beta 1,000", "people noticed", "a change quickly"])

        chunks = self.build_text_chunks("Researchers tracked 12,345 patients, and results improved.", max_words=6)
        self.assertEqual(chunks, ["Researchers tracked 12,345 patients", "and results improved"])

        chunks = self.build_text_chunks("The market reached 1,234,567 users fast.", max_words=6)
        self.assertEqual(chunks, ["The market reached 1,234,567 users fast"])

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

    def test_regression_keeps_hyphenated_and_contracted_alignment_in_sync(self) -> None:
        script_text = (
            "Put one fingertip near each corner of your mouth, then make a small closed-mouth smile at about thirty to forty percent effort. "
            "Keep it small. That’s the trick. The second you force it, the dominant side steals the rep. "
            "Watch for the first little jump, then slow that side down and guide the weaker side until both corners rise together. "
            "That’s what makes your face look calmer, more even, and better controlled on camera."
        )
        alignment_items = [
            {"text": "Put", "start_time": 0.0, "end_time": 0.16},
            {"text": "one", "start_time": 0.16, "end_time": 0.28},
            {"text": "fingertip", "start_time": 0.28, "end_time": 0.72},
            {"text": "near", "start_time": 0.72, "end_time": 0.88},
            {"text": "each", "start_time": 0.88, "end_time": 1.04},
            {"text": "corner", "start_time": 1.04, "end_time": 1.32},
            {"text": "of", "start_time": 1.32, "end_time": 1.40},
            {"text": "your", "start_time": 1.40, "end_time": 1.52},
            {"text": "mouth", "start_time": 1.52, "end_time": 1.80},
            {"text": "then", "start_time": 1.92, "end_time": 2.08},
            {"text": "make", "start_time": 2.08, "end_time": 2.28},
            {"text": "a", "start_time": 2.28, "end_time": 2.36},
            {"text": "small", "start_time": 2.36, "end_time": 2.64},
            {"text": "closedmouth", "start_time": 2.64, "end_time": 3.28},
            {"text": "smile", "start_time": 3.28, "end_time": 3.60},
            {"text": "at", "start_time": 3.60, "end_time": 3.72},
            {"text": "about", "start_time": 3.72, "end_time": 4.00},
            {"text": "thirty", "start_time": 4.00, "end_time": 4.28},
            {"text": "to", "start_time": 4.28, "end_time": 4.36},
            {"text": "forty", "start_time": 4.36, "end_time": 4.64},
            {"text": "percent", "start_time": 4.64, "end_time": 5.08},
            {"text": "effort", "start_time": 5.08, "end_time": 5.36},
            {"text": "Keep", "start_time": 5.52, "end_time": 5.76},
            {"text": "it", "start_time": 5.76, "end_time": 5.90},
            {"text": "small", "start_time": 5.90, "end_time": 6.24},
            {"text": "That's", "start_time": 6.40, "end_time": 6.84},
            {"text": "the", "start_time": 6.84, "end_time": 6.96},
            {"text": "trick", "start_time": 6.96, "end_time": 7.28},
            {"text": "The", "start_time": 7.44, "end_time": 7.64},
            {"text": "second", "start_time": 7.64, "end_time": 7.96},
            {"text": "you", "start_time": 7.96, "end_time": 8.12},
            {"text": "force", "start_time": 8.12, "end_time": 8.44},
            {"text": "it", "start_time": 8.44, "end_time": 8.60},
            {"text": "the", "start_time": 8.76, "end_time": 8.92},
            {"text": "dominant", "start_time": 8.92, "end_time": 9.36},
            {"text": "side", "start_time": 9.36, "end_time": 9.64},
            {"text": "steals", "start_time": 9.64, "end_time": 10.04},
            {"text": "the", "start_time": 10.04, "end_time": 10.16},
            {"text": "rep", "start_time": 10.16, "end_time": 10.44},
            {"text": "Watch", "start_time": 10.60, "end_time": 10.88},
            {"text": "for", "start_time": 10.88, "end_time": 11.00},
            {"text": "the", "start_time": 11.00, "end_time": 11.12},
            {"text": "first", "start_time": 11.12, "end_time": 11.44},
            {"text": "little", "start_time": 11.44, "end_time": 11.68},
            {"text": "jump", "start_time": 11.68, "end_time": 12.00},
            {"text": "then", "start_time": 12.16, "end_time": 12.36},
            {"text": "slow", "start_time": 12.36, "end_time": 12.56},
            {"text": "that", "start_time": 12.56, "end_time": 12.72},
            {"text": "side", "start_time": 12.72, "end_time": 12.96},
            {"text": "down", "start_time": 12.96, "end_time": 13.20},
            {"text": "and", "start_time": 13.20, "end_time": 13.32},
            {"text": "guide", "start_time": 13.32, "end_time": 13.64},
            {"text": "the", "start_time": 13.64, "end_time": 13.76},
            {"text": "weaker", "start_time": 13.76, "end_time": 14.08},
            {"text": "side", "start_time": 14.08, "end_time": 14.32},
            {"text": "until", "start_time": 14.32, "end_time": 14.64},
            {"text": "both", "start_time": 14.64, "end_time": 14.88},
            {"text": "corners", "start_time": 14.88, "end_time": 15.24},
            {"text": "rise", "start_time": 15.24, "end_time": 15.44},
            {"text": "together", "start_time": 15.44, "end_time": 15.92},
            {"text": "That's", "start_time": 16.08, "end_time": 16.52},
            {"text": "what", "start_time": 16.52, "end_time": 16.72},
            {"text": "makes", "start_time": 16.72, "end_time": 17.00},
            {"text": "your", "start_time": 17.00, "end_time": 17.16},
            {"text": "face", "start_time": 17.16, "end_time": 17.40},
            {"text": "look", "start_time": 17.40, "end_time": 17.64},
            {"text": "calmer", "start_time": 17.64, "end_time": 18.04},
            {"text": "more", "start_time": 18.16, "end_time": 18.36},
            {"text": "even", "start_time": 18.36, "end_time": 18.72},
            {"text": "and", "start_time": 18.88, "end_time": 19.00},
            {"text": "better", "start_time": 19.00, "end_time": 19.28},
            {"text": "controlled", "start_time": 19.28, "end_time": 19.72},
            {"text": "on", "start_time": 19.72, "end_time": 19.84},
            {"text": "camera", "start_time": 19.84, "end_time": 20.24},
        ]

        captions, _ = MODULE.build_captions(script_text, {"items": alignment_items}, 6)
        self.assertEqual(
            [(caption.text, round(caption.start, 2), round(caption.end, 2)) for caption in captions],
            [
                ("Put one fingertip", 0.00, 0.72),
                ("near each corner of your mouth", 0.72, 1.80),
                ("then make a small", 1.92, 2.64),
                ("closed-mouth smile", 2.64, 3.60),
                ("at about thirty to forty percent", 3.60, 5.08),
                ("effort", 5.08, 5.36),
                ("Keep it small", 5.52, 6.24),
                ("That’s the trick", 6.40, 7.28),
                ("The second you force it", 7.44, 8.60),
                ("the dominant side steals the rep", 8.76, 10.44),
                ("Watch for the first little jump", 10.60, 12.00),
                ("then slow that side down", 12.16, 13.20),
                ("and guide the weaker side", 13.20, 14.32),
                ("until both corners rise together", 14.32, 15.92),
                ("That’s what makes your face", 16.08, 17.40),
                ("look calmer", 17.40, 18.04),
                ("more even", 18.16, 18.72),
                ("and better controlled on camera", 18.88, 20.24),
            ],
        )
        self.assertTrue(all(captions[index].start >= captions[index - 1].end for index in range(1, len(captions))))


if __name__ == "__main__":
    unittest.main()
