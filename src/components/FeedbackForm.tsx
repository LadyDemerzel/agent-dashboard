"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FeedbackForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [doMore, setDoMore] = useState("");
  const [doLess, setDoLess] = useState("");
  const [tryNew, setTryNew] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || rating === 0) {
      setError("Please provide feedback and a rating.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/x-posts/${postId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, rating, doMore, doLess, tryNew }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      setFeedback("");
      setRating(0);
      setDoMore("");
      setDoLess("");
      setTryNew("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <p className="text-emerald-400 font-medium">
          Feedback submitted successfully!
        </p>
        <p className="text-zinc-500 text-sm mt-1">
          TACIT.md has been updated with your learnings.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Add more feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div>
        <label className="block text-zinc-400 text-sm mb-2">Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className={`text-2xl transition-colors ${
                star <= (hoverRating || rating)
                  ? "text-amber-400"
                  : "text-zinc-700"
              }`}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span className="text-zinc-500 text-sm ml-2">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Feedback text */}
      <div>
        <label className="block text-zinc-400 text-sm mb-2">
          Your Feedback
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What do you think of this post? How could it be improved?"
          rows={4}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none resize-none"
        />
      </div>

      {/* Learning fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Do more of...
          </label>
          <input
            type="text"
            value={doMore}
            onChange={(e) => setDoMore(e.target.value)}
            placeholder="e.g., personal stories"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Do less of...
          </label>
          <input
            type="text"
            value={doLess}
            onChange={(e) => setDoLess(e.target.value)}
            placeholder="e.g., generic advice"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">Try...</label>
          <input
            type="text"
            value={tryNew}
            onChange={(e) => setTryNew(e.target.value)}
            placeholder="e.g., ask a question"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </button>
    </form>
  );
}
