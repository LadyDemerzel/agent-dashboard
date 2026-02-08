import fs from "fs";
import path from "path";
import { parseFrontMatter, generateFrontMatter, FrontMatter } from "./frontmatter";

const POSTS_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "x-posts"
);

const FEEDBACK_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "content",
  "feedback"
);

const TACIT_PATH = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "agents",
  "scribe",
  "TACIT.md"
);

export interface XPost {
  id: string;
  title: string;
  date: string;
  postNumber: number;
  status: "draft" | "needs review" | "requested changes" | "approved" | "published";
  content: string;
  suggestedTime: string;
  category: string;
  engagementStrategy: string;
  hashtags: string;
  feedbackCount: number;
  filePath: string;
  agent: string;
}

export interface Feedback {
  id: string;
  postId: string;
  date: string;
  content: string;
  rating: number;
  learnings: string;
}

function normalizeStatus(status: string | undefined): XPost['status'] {
  if (!status) return 'draft';
  const lower = status.toLowerCase();
  if (lower === 'published') return 'published';
  if (lower === 'approved') return 'approved';
  if (lower === 'requested changes') return 'requested changes';
  if (lower === 'needs review' || lower === 'review') return 'needs review';
  return 'draft';
}

function extractField(content: string, field: string): string {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(
    `## ${heading}\\n+([\\s\\S]*?)(?=\\n## |$)`,
    "i"
  );
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractTitle(content: string, frontMatter?: FrontMatter): string {
  if (frontMatter?.title) return frontMatter.title;
  
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled Post";
}

export function getXPosts(): XPost[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const dateDirs = fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const posts: XPost[] = [];

  for (const dateDir of dateDirs) {
    const datePath = path.join(POSTS_DIR, dateDir.name);
    const files = fs.readdirSync(datePath).filter((f) => f.endsWith(".md"));

    for (const filename of files) {
      const filePath = path.join(datePath, filename);
      const raw = fs.readFileSync(filePath, "utf-8");
      const postNumMatch = filename.match(/post-(\d+)/);
      const postNumber = postNumMatch ? parseInt(postNumMatch[1]) : 0;
      const id = `${dateDir.name}_post-${postNumber}`;

      // Try to parse YAML front matter
      const parsed = parseFrontMatter(raw);
      const frontMatter = parsed?.frontMatter;
      const body = parsed?.body || raw;

      const feedbackFiles = getFeedbackForPost(postNumber);

      posts.push({
        id,
        title: extractTitle(body, frontMatter),
        date: dateDir.name,
        postNumber,
        status: normalizeStatus(frontMatter?.status),
        content: extractSection(body, "Content"),
        suggestedTime: frontMatter?.suggestedTime || extractField(body, "Suggested Time"),
        category: frontMatter?.category || extractField(body, "Category"),
        engagementStrategy: frontMatter?.engagementStrategy || extractSection(body, "Engagement Strategy"),
        hashtags: frontMatter?.hashtags || extractSection(body, "Hashtags"),
        feedbackCount: feedbackFiles.length,
        filePath,
        agent: frontMatter?.agent || 'Scribe',
      });
    }
  }

  return posts.sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() ||
      a.postNumber - b.postNumber
  );
}

export function getXPost(id: string): XPost | null {
  const posts = getXPosts();
  return posts.find((p) => p.id === id) || null;
}

export function getFeedbackForPost(postNumber: number): Feedback[] {
  if (!fs.existsSync(FEEDBACK_DIR)) return [];

  const files = fs
    .readdirSync(FEEDBACK_DIR)
    .filter((f) => f.startsWith(`post-${postNumber}-feedback-`));

  return files.map((filename) => {
    const filePath = path.join(FEEDBACK_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    const dateMatch = filename.match(/feedback-(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "";

    const ratingMatch = raw.match(/## Rating\n+(\d)/);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

    return {
      id: Buffer.from(filename).toString("base64url"),
      postId: `post-${postNumber}`,
      date,
      content: extractSection(raw, "Ittai's Feedback") || extractSection(raw, "Feedback"),
      rating,
      learnings: extractSection(raw, "Learning Extracted"),
    };
  });
}

export function saveFeedback(
  postNumber: number,
  postContent: string,
  feedbackText: string,
  rating: number,
  doMore: string,
  doLess: string,
  tryNew: string
): string {
  const today = new Date().toISOString().split("T")[0];
  const filename = `post-${postNumber}-feedback-${today}.md`;
  const filePath = path.join(FEEDBACK_DIR, filename);

  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }

  const feedbackMd = `# Feedback on Post ${postNumber} - ${today}

## Original Post
${postContent}

## Ittai's Feedback
${feedbackText}

## Rating
${rating}

## Learning Extracted
- Do more of: ${doMore}
- Do less of: ${doLess}
- Try: ${tryNew}

## Applied to TACIT.md
- [x] Updated style guide
- [ ] Next post implementation
`;

  fs.writeFileSync(filePath, feedbackMd, "utf-8");

  // Update TACIT.md
  updateTacit(today, postNumber, doMore, doLess, tryNew);

  return filename;
}

function updateTacit(
  date: string,
  postNumber: number,
  doMore: string,
  doLess: string,
  tryNew: string
) {
  if (!fs.existsSync(TACIT_PATH)) return;

  const content = fs.readFileSync(TACIT_PATH, "utf-8");
  const newLearning = `
### From Post ${postNumber} (${date})
- Do more of: ${doMore}
- Do less of: ${doLess}
- Try: ${tryNew}
`;

  const updated = content + newLearning;
  fs.writeFileSync(TACIT_PATH, updated, "utf-8");
}
