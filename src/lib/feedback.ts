import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export interface FeedbackComment {
  id: string;
  threadId: string;
  author: "user" | "agent";
  content: string;
  createdAt: string;
}

export interface FeedbackThread {
  id: string;
  deliverableId: string;
  agentId: string;
  startLine: number | null;
  endLine: number | null;
  createdAt: string;
  status: "open" | "resolved";
  comments: FeedbackComment[];
}

export interface FeedbackData {
  threads: FeedbackThread[];
}

function getFeedbackPath(deliverableFilePath: string): string {
  const dir = path.dirname(deliverableFilePath);
  const base = path.basename(deliverableFilePath, ".md");
  return path.join(dir, `${base}-feedback.json`);
}

export function readFeedback(deliverableFilePath: string): FeedbackData {
  const feedbackPath = getFeedbackPath(deliverableFilePath);
  if (!fs.existsSync(feedbackPath)) {
    return { threads: [] };
  }
  try {
    const raw = fs.readFileSync(feedbackPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { threads: [] };
  }
}

export function writeFeedback(
  deliverableFilePath: string,
  feedback: FeedbackData
): void {
  const feedbackPath = getFeedbackPath(deliverableFilePath);
  const dir = path.dirname(feedbackPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2), "utf-8");
}

export function createThread(
  deliverableFilePath: string,
  deliverableId: string,
  agentId: string,
  startLine: number | null,
  endLine: number | null,
  content: string,
  author: "user" | "agent" = "user"
): FeedbackThread {
  const feedback = readFeedback(deliverableFilePath);
  
  const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newThread: FeedbackThread = {
    id: threadId,
    deliverableId,
    agentId,
    startLine,
    endLine,
    createdAt: new Date().toISOString(),
    status: "open",
    comments: [
      {
        id: commentId,
        threadId,
        author,
        content,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  
  feedback.threads.push(newThread);
  writeFeedback(deliverableFilePath, feedback);
  
  return newThread;
}

export function addComment(
  deliverableFilePath: string,
  threadId: string,
  content: string,
  author: "user" | "agent"
): FeedbackComment | null {
  const feedback = readFeedback(deliverableFilePath);
  const thread = feedback.threads.find((t) => t.id === threadId);
  
  if (!thread) return null;
  
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newComment: FeedbackComment = {
    id: commentId,
    threadId,
    author,
    content,
    createdAt: new Date().toISOString(),
  };
  
  thread.comments.push(newComment);
  writeFeedback(deliverableFilePath, feedback);
  
  return newComment;
}

export function updateThreadStatus(
  deliverableFilePath: string,
  threadId: string,
  status: "open" | "resolved"
): FeedbackThread | null {
  const feedback = readFeedback(deliverableFilePath);
  const thread = feedback.threads.find((t) => t.id === threadId);
  
  if (!thread) return null;
  
  thread.status = status;
  writeFeedback(deliverableFilePath, feedback);
  
  return thread;
}

export function getThreadsForDeliverable(
  deliverableFilePath: string
): FeedbackThread[] {
  const feedback = readFeedback(deliverableFilePath);
  return feedback.threads;
}

export function getOpenThreadCount(deliverableFilePath: string): number {
  const feedback = readFeedback(deliverableFilePath);
  return feedback.threads.filter((t) => t.status === "open").length;
}

export function deleteThread(
  deliverableFilePath: string,
  threadId: string
): boolean {
  const feedback = readFeedback(deliverableFilePath);
  const initialLength = feedback.threads.length;
  feedback.threads = feedback.threads.filter((t) => t.id !== threadId);
  
  if (feedback.threads.length < initialLength) {
    writeFeedback(deliverableFilePath, feedback);
    return true;
  }
  return false;
}

// Helper functions for inline vs top-level threads
export function getInlineThreads(deliverableFilePath: string): FeedbackThread[] {
  const feedback = readFeedback(deliverableFilePath);
  return feedback.threads.filter((t) => t.startLine !== null && t.endLine !== null);
}

export function getTopLevelThreads(deliverableFilePath: string): FeedbackThread[] {
  const feedback = readFeedback(deliverableFilePath);
  return feedback.threads.filter((t) => t.startLine === null || t.endLine === null);
}
