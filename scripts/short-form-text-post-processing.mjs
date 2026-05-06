const AUXILIARY_FOLLOWERS = [
  "been",
  "being",
  "done",
  "gone",
  "got",
  "gotten",
  "had",
  "made",
  "seen",
  "shown",
  "taken",
  "given",
  "found",
  "left",
  "lost",
  "won",
  "changed",
  "started",
  "finished",
  "moved",
  "grown",
  "become",
  "built",
  "opened",
  "closed",
  "turned",
  "put",
  "set",
  "hit",
  "felt",
  "kept",
  "created",
  "trained",
  "worked",
  "looked",
  "picked",
  "called",
  "measured",
  "proved",
  "shown",
];

const SIMPLE_CONTRACTIONS = [
  ["cannot", "can't"],
  ["can not", "can't"],
  ["is not", "isn't"],
  ["are not", "aren't"],
  ["was not", "wasn't"],
  ["were not", "weren't"],
  ["do not", "don't"],
  ["does not", "doesn't"],
  ["did not", "didn't"],
  ["could not", "couldn't"],
  ["will not", "won't"],
  ["would not", "wouldn't"],
  ["should not", "shouldn't"],
  ["have not", "haven't"],
  ["has not", "hasn't"],
  ["had not", "hadn't"],
  ["must not", "mustn't"],
  ["might not", "mightn't"],
  ["I am not", "I'm not"],
  ["I am", "I'm"],
  ["I will", "I'll"],
  ["I would", "I'd"],
  ["you are", "you're"],
  ["you will", "you'll"],
  ["you would", "you'd"],
  ["he is", "he's"],
  ["he will", "he'll"],
  ["he would", "he'd"],
  ["she is", "she's"],
  ["she will", "she'll"],
  ["she would", "she'd"],
  ["it is", "it's"],
  ["it will", "it'll"],
  ["it would", "it'd"],
  ["we are", "we're"],
  ["we will", "we'll"],
  ["we would", "we'd"],
  ["they are", "they're"],
  ["they will", "they'll"],
  ["they would", "they'd"],
  ["there is", "there's"],
  ["there will", "there'll"],
  ["here is", "here's"],
  ["that is", "that's"],
  ["that will", "that'll"],
  ["that would", "that'd"],
  ["what is", "what's"],
  ["what will", "what'll"],
  ["what would", "what'd"],
  ["who is", "who's"],
  ["who will", "who'll"],
  ["who would", "who'd"],
  ["where is", "where's"],
  ["where will", "where'll"],
  ["where would", "where'd"],
  ["let us", "let's"],
];

const AUXILIARY_CONTRACTIONS = [
  ["I have", "I've"],
  ["I had", "I'd"],
  ["you have", "you've"],
  ["you had", "you'd"],
  ["he has", "he's"],
  ["he had", "he'd"],
  ["she has", "she's"],
  ["she had", "she'd"],
  ["it has", "it's"],
  ["it had", "it'd"],
  ["we have", "we've"],
  ["we had", "we'd"],
  ["they have", "they've"],
  ["they had", "they'd"],
  ["there has", "there's"],
  ["there had", "there'd"],
  ["that has", "that's"],
  ["that had", "that'd"],
  ["what has", "what's"],
  ["what had", "what'd"],
  ["who has", "who's"],
  ["who had", "who'd"],
  ["where has", "where's"],
  ["where had", "where'd"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyMatchCase(match, replacement) {
  if (match === match.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(match)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function replacePhrase(text, phrase, replacement) {
  const pattern = new RegExp(`(?<![A-Za-z0-9'])${escapeRegExp(phrase)}(?![A-Za-z0-9'])`, "gi");
  return text.replace(pattern, (match) => applyMatchCase(match, replacement));
}

function replaceAuxiliaryPhrase(text, phrase, replacement) {
  const followers = AUXILIARY_FOLLOWERS.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?<![A-Za-z0-9'])${escapeRegExp(phrase)}(?=\\s+(?:${followers})(?![A-Za-z0-9']))`, "gi");
  return text.replace(pattern, (match) => applyMatchCase(match, replacement));
}

export function enforceNaturalContractions(text) {
  let result = String(text || "");
  for (const [phrase, replacement] of AUXILIARY_CONTRACTIONS) {
    result = replaceAuxiliaryPhrase(result, phrase, replacement);
  }
  for (const [phrase, replacement] of SIMPLE_CONTRACTIONS) {
    result = replacePhrase(result, phrase, replacement);
  }
  return result;
}

export function formatNumericPercentages(text) {
  return String(text || "").replace(
    /(?<![A-Za-z0-9])(\d+(?:,\d{3})*(?:\.\d+)?)\s+per\s+cent(?![A-Za-z0-9])/gi,
    "$1%",
  ).replace(
    /(?<![A-Za-z0-9])(\d+(?:,\d{3})*(?:\.\d+)?)\s+percent(?![A-Za-z0-9])/gi,
    "$1%",
  );
}

export function postProcessShortFormText(text, options = {}) {
  const enforceContractions = options.enforceContractions !== false;
  const formatPercentages = options.formatNumericPercentages !== false;
  let result = String(text || "");
  if (enforceContractions) {
    result = enforceNaturalContractions(result);
  }
  if (formatPercentages) {
    result = formatNumericPercentages(result);
  }
  return result;
}

export function postProcessTextScriptMarkdown(content, options = {}) {
  const source = String(content || "");
  const match = source.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (!match) {
    return postProcessShortFormText(source, options);
  }
  return `${match[1]}${postProcessShortFormText(match[2], options)}`;
}
