import Link from "next/link";
import { getXPosts } from "@/lib/xposts";
import { getApprovedResearch } from "@/lib/research";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function XPostsPage() {
  const posts = getXPosts();
  const approvedResearch = getApprovedResearch();

  const byDate: Record<string, typeof posts> = {};
  for (const post of posts) {
    if (!byDate[post.date]) byDate[post.date] = [];
    byDate[post.date].push(post);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">✍️</span>
          <h1 className="text-2xl font-bold text-white">X Posts</h1>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Scribe&apos;s X post drafts with feedback and learning
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard
          label="Drafts"
          value={posts.filter((p) => p.status === "draft").length}
        />
        <StatCard
          label="In Review"
          value={posts.filter((p) => p.status === "needs review").length}
        />
        <StatCard
          label="With Feedback"
          value={posts.filter((p) => p.feedbackCount > 0).length}
        />
      </div>

      {/* Approved Research Section */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <h2 className="text-sm font-medium text-zinc-300">
              Approved Research
            </h2>
            <span className="text-xs text-zinc-600">
              ({approvedResearch.length} available for content creation)
            </span>
          </div>
          <Link
            href="/research"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all research →
          </Link>
        </div>
        
        {approvedResearch.length === 0 ? (
          <p className="text-zinc-600 text-sm">
            No approved research yet. Echo&apos;s research needs to be approved before Scribe can reference it for content.
          </p>
        ) : (
          <div className="space-y-2">
            {approvedResearch.slice(0, 3).map((research) => (
              <Link
                key={research.id}
                href={`/research/${research.id}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-zinc-950/50 hover:bg-zinc-950 transition-colors"
              >
                <span className="text-emerald-500 text-xs">●</span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-sm truncate">
                    {research.title}
                  </p>
                  <p className="text-zinc-600 text-xs">
                    {new Date(research.date).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
            {approvedResearch.length > 3 && (
              <p className="text-zinc-600 text-xs text-center pt-1">
                +{approvedResearch.length - 3} more approved research items
              </p>
            )}
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500">No X post drafts found yet.</p>
          <p className="text-zinc-600 text-sm mt-1">
            Scribe&apos;s drafts will appear here when available.
          </p>
        </div>
      ) : (
        Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, datePosts]) => (
            <div key={date} className="mb-8">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {datePosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

function PostCard({ post }: { post: ReturnType<typeof getXPosts>[0] }) {
  return (
    <Link href={`/x-posts/${post.id}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-zinc-500 font-mono">
            Post #{post.postNumber}
          </span>
          <StatusBadge status={post.status} />
        </div>

        <h3 className="text-white font-medium text-sm mb-2">{post.title}</h3>

        <p className="text-zinc-400 text-sm line-clamp-4 flex-1">
          {post.content.slice(0, 200)}
          {post.content.length > 200 ? "..." : ""}
        </p>

        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            {post.category && (
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                {post.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {post.feedbackCount > 0 && (
              <span className="text-amber-400">
                {post.feedbackCount} feedback
              </span>
            )}
            <span>{post.suggestedTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
