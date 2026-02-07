import { notFound } from "next/navigation";
import Link from "next/link";
import { getXPost, getFeedbackForPost } from "@/lib/xposts";
import { getXPostStatusLog } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusChangeForm } from "@/components/StatusChangeForm";
import { StatusLog } from "@/components/StatusLog";
import { FeedbackForm } from "@/components/FeedbackForm";

export const dynamic = "force-dynamic";

export default async function XPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) notFound();

  const feedback = getFeedbackForPost(post.postNumber);
  const statusLog = getXPostStatusLog(id);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <Link
        href="/x-posts"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to X Posts
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-white">{post.title}</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Post #{post.postNumber} · {post.date}
                </p>
              </div>
              <StatusBadge status={post.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-zinc-500">Category: </span>
                <span className="text-zinc-300">{post.category || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Suggested Time: </span>
                <span className="text-zinc-300">
                  {post.suggestedTime || "—"}
                </span>
              </div>
            </div>

            <StatusChangeForm
              currentStatus={post.status}
              itemId={post.id}
              itemType="x-post"
            />
          </div>

          {/* Post Content */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Post Content
            </h2>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
              <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
                {post.content}
              </p>
            </div>
            {post.hashtags && (
              <div className="mt-3">
                <p className="text-indigo-400 text-sm">{post.hashtags}</p>
              </div>
            )}
          </div>

          {/* Engagement Strategy */}
          {post.engagementStrategy && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
                Engagement Strategy
              </h2>
              <div className="text-zinc-400 text-sm whitespace-pre-wrap">
                {post.engagementStrategy}
              </div>
            </div>
          )}

          {/* Feedback History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Feedback ({feedback.length})
            </h2>

            {feedback.length === 0 ? (
              <p className="text-zinc-600 text-sm">
                No feedback yet. Add feedback below to help Scribe improve.
              </p>
            ) : (
              <div className="space-y-4">
                {feedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-500 text-xs">{fb.date}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={`text-sm ${i < fb.rating ? "text-amber-400" : "text-zinc-700"}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-zinc-300 text-sm">{fb.content}</p>
                    {fb.learnings && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                          Learnings
                        </p>
                        <p className="text-zinc-400 text-sm whitespace-pre-wrap">
                          {fb.learnings}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Feedback Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Add Feedback
            </h2>
            <FeedbackForm postId={post.id} />
          </div>
        </div>

        {/* Right Sidebar - Status Log */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Status History
            </h2>
            <StatusLog logs={statusLog.logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
