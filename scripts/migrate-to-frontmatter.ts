#!/usr/bin/env node
/**
 * Migrate deliverables from inline status headers to YAML front matter
 * 
 * Usage:
 *   node scripts/migrate-to-frontmatter.ts
 *   node scripts/migrate-to-frontmatter.ts --dry-run
 */

import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

interface MigrationResult {
  file: string;
  success: boolean;
  error?: string;
}

/**
 * Generate YAML front matter string
 */
function generateFrontMatter(data: Record<string, string | string[]>): string {
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
function hasFrontMatter(content: string): boolean {
  return /^---\s*\n/.test(content);
}

/**
 * Migrate a single file
 */
function migrateFile(filePath: string, dryRun: boolean): MigrationResult {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    
    // Skip if already has front matter
    if (hasFrontMatter(content)) {
      return { file: filePath, success: true };
    }

    // Extract metadata from inline format
    const frontMatter: Record<string, string | string[]> = {};
    
    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      frontMatter.title = titleMatch[1].trim();
    }
    
    // Extract status
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i) || 
                        content.match(/\*\*Status:\s*(.+)\*\*/i) ||
                        content.match(/status:\s*(.+)/i);
    if (statusMatch) {
      frontMatter.status = statusMatch[1].trim();
    } else {
      frontMatter.status = 'draft';
    }
    
    // Extract date
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/i) ||
                      content.match(/date:\s*(.+)/i);
    if (dateMatch) {
      frontMatter.date = dateMatch[1].trim();
    } else {
      // Try to extract from filename
      const filename = path.basename(filePath);
      const dateFromFile = filename.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateFromFile) {
        frontMatter.date = dateFromFile[1];
      } else {
        frontMatter.date = new Date().toISOString().split('T')[0];
      }
    }
    
    // Extract agent
    const agentMatch = content.match(/\*\*Agent:\*\*\s*(.+)/i) ||
                       content.match(/agent:\s*(.+)/i);
    if (agentMatch) {
      frontMatter.agent = agentMatch[1].trim();
    } else {
      // Infer from directory
      if (filePath.includes('market-research')) frontMatter.agent = 'Echo';
      else if (filePath.includes('content')) frontMatter.agent = 'Scribe';
      else if (filePath.includes('engineering')) frontMatter.agent = 'Ralph';
      else if (filePath.includes('strategy')) frontMatter.agent = 'Oracle';
      else if (filePath.includes('operations')) frontMatter.agent = 'Clerk';
      else frontMatter.agent = 'Unknown';
    }
    
    // Extract category for x-posts
    const categoryMatch = content.match(/\*\*Category:\*\*\s*(.+)/i) ||
                          content.match(/category:\s*(.+)/i);
    if (categoryMatch) {
      frontMatter.category = categoryMatch[1].trim();
    }
    
    // Extract suggested time for x-posts
    const timeMatch = content.match(/\*\*Suggested Time:\*\*\s*(.+)/i) ||
                      content.match(/suggestedTime:\s*(.+)/i);
    if (timeMatch) {
      frontMatter.suggestedTime = timeMatch[1].trim();
    }

    // Clean up body by removing extracted inline metadata
    let body = content;
    body = body.replace(/\*\*Status:\*\*\s*.+\n?/gi, '');
    body = body.replace(/\*\*Status:\s*[^*]+\*\*\n?/gi, '');
    body = body.replace(/\*\*Date:\*\*\s*.+\n?/gi, '');
    body = body.replace(/\*\*Agent:\*\*\s*.+\n?/gi, '');
    body = body.replace(/\*\*Category:\*\*\s*.+\n?/gi, '');
    body = body.replace(/\*\*Suggested Time:\*\*\s*.+\n?/gi, '');
    body = body.replace(/status:\s*.+\n?/gi, '');
    body = body.replace(/date:\s*.+\n?/gi, '');
    body = body.replace(/agent:\s*.+\n?/gi, '');
    body = body.replace(/\n{3,}/g, '\n\n'); // Clean up extra newlines
    
    const newContent = generateFrontMatter(frontMatter) + '\n\n' + body.trim();
    
    if (!dryRun) {
      fs.writeFileSync(filePath, newContent, "utf-8");
    }
    
    return { file: filePath, success: true };
  } catch (error) {
    return { 
      file: filePath, 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Find all markdown files in a directory recursively
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Main migration function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('🔧 Deliverable Migration Tool');
  console.log('==============================');
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - No files will be modified\n');
  } else {
    console.log('⚠️  LIVE MODE - Files will be modified\n');
  }
  
  const deliverableDirs = [
    path.join(BUSINESS_ROOT, 'market-research', 'deliverables'),
    path.join(BUSINESS_ROOT, 'content', 'deliverables'),
    path.join(BUSINESS_ROOT, 'engineering', 'deliverables'),
    path.join(BUSINESS_ROOT, 'strategy', 'deliverables'),
    path.join(BUSINESS_ROOT, 'operations', 'deliverables'),
  ];
  
  const results: MigrationResult[] = [];
  
  for (const dir of deliverableDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`⏭️  Skipping (not found): ${dir}`);
      continue;
    }
    
    console.log(`\n📁 Scanning: ${dir}`);
    const files = findMarkdownFiles(dir);
    console.log(`   Found ${files.length} markdown files`);
    
    for (const file of files) {
      const result = migrateFile(file, dryRun);
      results.push(result);
      
      if (result.success) {
        if (hasFrontMatter(fs.readFileSync(file, 'utf-8'))) {
          console.log(`   ✅ Already has front matter: ${path.basename(file)}`);
        } else {
          console.log(`   ✨ Migrated: ${path.basename(file)}`);
        }
      } else {
        console.log(`   ❌ Failed: ${path.basename(file)} - ${result.error}`);
      }
    }
  }
  
  // Summary
  const migrated = results.filter(r => r.success && !hasFrontMatter(fs.readFileSync(r.file, 'utf-8'))).length;
  const alreadyMigrated = results.filter(r => r.success && hasFrontMatter(fs.readFileSync(r.file, 'utf-8'))).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n==============================');
  console.log('📊 Migration Summary');
  console.log('==============================');
  console.log(`   Total files: ${results.length}`);
  console.log(`   Newly migrated: ${migrated}`);
  console.log(`   Already migrated: ${alreadyMigrated}`);
  console.log(`   Failed: ${failed}`);
  
  if (dryRun) {
    console.log('\n🏃 This was a dry run. No files were modified.');
    console.log('   Run without --dry-run to apply changes.');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
