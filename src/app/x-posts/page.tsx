import Link from "next/link";
import { getXPosts } from "@/lib/xposts";
import { getApprovedResearch } from "@/lib/research";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        <div className="mb-1">
          <h1 className="text-2xl font-bold text-foreground">X Posts</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Scribe&apos;s X post drafts with feedback and learning
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard label="Drafts" value={posts.filter((p) => p.status === "draft").length} />
        <StatCard label="In Review" value={posts.filter((p) => p.status === "needs review").length} />
        <StatCard label="With Feedback" value={posts.filter((p) => p.feedbackCount > 0).length} />
      </div>

      {/* Approved Research Section */}
      <Card className="p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-foreground">Approved Research</h2>
            <span className="text-xs text-muted-foreground">({approvedResearch.length} available for content creation)</span>
          </div>
          <Link href="/research" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all research →
          </Link>
        </div>

        {approvedResearch.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No approved research yet. Echo&apos;s research needs to be approved before Scribe can reference it for content.
          </p>
        ) : (
          <div className="space-y-2">
            {approvedResearch.slice(0, 3).map((research) => (
              <Link
                key={research.id}
                href={`/research/${research.id}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/50 hover:bg-background transition-colors"
              >
                <span className="text-emerald-500 text-xs">●</span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm truncate">{research.title}</p>
                  <p className="text-muted-foreground text-xs">{new Date(research.date).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
            {approvedResearch.length > 3 && (
              <p className="text-muted-foreground text-xs text-center pt-1">
                +{approvedResearch.length - 3} more approved research items
              </p>
            )}
          </div>
        )}
      </Card>

      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No X post drafts found yet.</p>
          <p className="text-muted-foreground text-sm mt-1">
            Scribe&apos;s drafts will appear here when available.
          </p>
        </Card>
      ) : (
        Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, datePosts]) => (
            <div key={date} className="mb-8">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
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
      <Card className="p-5 hover:border-ring/50 transition-colors h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-muted-foreground font-mono">Post #{post.postNumber}</span>
          <StatusBadge status={post.status} />
        </div>

        <h3 className="text-foreground font-medium text-sm mb-2">{post.title}</h3>

        <p className="text-muted-foreground text-sm line-clamp-4 flex-1">
          {post.content.slice(0, 200)}
          {post.content.length > 200 ? "..." : ""}
        </p>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {post.category && (
              <Badge variant="default">{post.category}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {post.feedbackCount > 0 && (
              <span className="text-amber-400">{post.feedbackCount} feedback</span>
            )}
            <span>{post.suggestedTime}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </Card>
  );
}
