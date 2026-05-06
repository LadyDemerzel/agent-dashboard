import assert from "node:assert/strict";
import {
  enforceNaturalContractions,
  formatNumericPercentages,
  postProcessTextScriptMarkdown,
} from "./short-form-text-post-processing.mjs";

assert.equal(
  enforceNaturalContractions("That is clear. Here is the rep. You will see it. It is not a hard squint."),
  "That's clear. Here's the rep. You'll see it. It isn't a hard squint.",
);

assert.equal(
  enforceNaturalContractions("You are not stuck, and they are not either. I am not guessing."),
  "You aren't stuck, and they aren't either. I'm not guessing.",
);

assert.equal(
  enforceNaturalContractions("It has a clean shape. It has changed fast. You have a mirror. You have seen the cue."),
  "It has a clean shape. It's changed fast. You have a mirror. You've seen the cue.",
);

assert.equal(
  formatNumericPercentages("The result was 87.8 percent, then 1,200 per cent in a bad example, but some percent stayed words."),
  "The result was 87.8%, then 1,200% in a bad example, but some percent stayed words.",
);

assert.equal(
  postProcessTextScriptMarkdown("---\ntitle: Test\n---\n\nThat is 87.8 percent. It is not vague."),
  "---\ntitle: Test\n---\n\nThat's 87.8%. It isn't vague.",
);

assert.equal(
  postProcessTextScriptMarkdown("---\ntitle: Test\n---\n\nThat is 87.8 percent.", {
    enforceContractions: false,
    formatNumericPercentages: true,
  }),
  "---\ntitle: Test\n---\n\nThat is 87.8%.",
);

console.log("short-form text post-processing tests passed");
