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

/**
 * Parse YAML front matter from markdown content
 * Returns { frontMatter, body } or null if no front matter
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
export function parseFrontMatter(content: string): { frontMatter: FrontMatter; body: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;

  const yamlText = match[1];
  const body = match[2];

  const frontMatter: FrontMatter = {};
  
  const lines = yamlText.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  let indentLevel = 0;
  
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
    const keyValueMatch = trimmed.match(/^(\w+):\s*(.*)$/);
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
  
  return { frontMatter, body };
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
  return /^---\s*\n/.test(content);
}

/**
 * Extract body content (without front matter)
 */
export function extractBody(content: string): string {
  const parsed = parseFrontMatter(content);
  return parsed?.body || content;
}
