/**
 * YAML Front Matter utilities
 * Simple parser/generator without external dependencies
 */

export interface FrontMatter {
  title?: string;
  status?: string;
  date?: string;
  agent?: string;
  tags?: string[];
  category?: string;
  suggestedTime?: string;
  engagementStrategy?: string;
  hashtags?: string;
  [key: string]: unknown;
}

interface FrontMatterParseResult {
  frontMatter: FrontMatter;
  body: string;
  leadingText?: string;
}

const STRICT_FRONT_MATTER_RE = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;
const FRONT_MATTER_MARKER_RE = /^---[ \t]*$/gm;

function leadingTextCanBeStripped(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length <= 3 && lines.every((line) =>
    line.length <= 120 &&
    !line.includes(":") &&
    !line.includes("<") &&
    !line.includes(">") &&
    !line.startsWith("---")
  );
}

function looksLikeYamlFrontMatter(value: string) {
  return /(^|\r?\n)\s*[A-Za-z_][\w-]*\s*:/m.test(value);
}

function findRecoverableFrontMatter(content: string): {
  yamlText: string;
  body: string;
  leadingText?: string;
} | null {
  FRONT_MATTER_MARKER_RE.lastIndex = 0;
  const firstMarker = FRONT_MATTER_MARKER_RE.exec(content);
  if (!firstMarker || firstMarker.index === 0) return null;

  const leadingText = content.slice(0, firstMarker.index);
  if (!leadingTextCanBeStripped(leadingText)) return null;

  const secondMarker = FRONT_MATTER_MARKER_RE.exec(content);
  if (!secondMarker) return null;

  const yamlText = content.slice(firstMarker.index + firstMarker[0].length, secondMarker.index).replace(/^\r?\n/, "");
  if (!looksLikeYamlFrontMatter(yamlText)) return null;

  const afterMarkerStart = secondMarker.index + secondMarker[0].length;
  const body = content.slice(afterMarkerStart).replace(/^\r?\n/, "");
  return { yamlText, body, leadingText };
}

function parseYamlFrontMatter(yamlText: string): FrontMatter {
  const frontMatter: FrontMatter = {};

  const lines = yamlText.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for array item (starts with - and is indented)
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim());
      }
      continue;
    }

    // If we were building an array, save it
    if (currentKey && currentArray.length > 0) {
      frontMatter[currentKey] = currentArray;
      currentArray = [];
    }

    // Parse key: value
    const keyValueMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      currentKey = key;

      if (value) {
        // Strip quotes if present
        const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
        frontMatter[key] = cleanValue;
        currentKey = null;
      }
    }
  }

  // Don't forget the last array
  if (currentKey && currentArray.length > 0) {
    frontMatter[currentKey] = currentArray;
  }

  return frontMatter;
}

/**
 * Parse YAML front matter from markdown content
 * Returns { frontMatter, body } or null if no front matter.
 * If a user accidentally leaves a short title line before otherwise valid
 * front matter, it is recovered and exposed as leadingText for callers that
 * want to repair the file on save.
 * 
 * Example format:
 * ---
 * title: "My Title"
 * status: needs review
 * date: 2026-02-07
 * agent: Echo
 * tags:
 *   - research
 *   - ai-agents
 * ---
 */
export function parseFrontMatter(content: string): FrontMatterParseResult | null {
  const match = content.match(STRICT_FRONT_MATTER_RE);
  if (match) {
    return {
      frontMatter: parseYamlFrontMatter(match[1]),
      body: match[2],
    };
  }

  const recovered = findRecoverableFrontMatter(content);
  if (!recovered) return null;

  return {
    frontMatter: parseYamlFrontMatter(recovered.yamlText),
    body: recovered.body,
    leadingText: recovered.leadingText,
  };
}

/**
 * Generate YAML front matter string
 */
export function generateFrontMatter(data: FrontMatter): string {
  const lines = ['---'];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'string') {
      // Quote strings that contain special characters
      if (value.includes(':') || value.includes('#') || value.startsWith('"') || value.startsWith("'")) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

/**
 * Check if content has YAML front matter
 */
export function hasFrontMatter(content: string): boolean {
  return parseFrontMatter(content) !== null;
}

/**
 * Extract body content (without front matter)
 */
export function extractBody(content: string): string {
  const parsed = parseFrontMatter(content);
  return parsed?.body || content;
}

/**
 * Remove recoverable accidental text before a valid YAML front matter block.
 */
export function normalizeFrontMatterContent(content: string): {
  content: string;
  repaired: boolean;
  leadingText?: string;
} {
  const parsed = parseFrontMatter(content);
  if (!parsed?.leadingText) {
    return { content, repaired: false };
  }

  return {
    content: content.slice(parsed.leadingText.length),
    repaired: true,
    leadingText: parsed.leadingText,
  };
}
