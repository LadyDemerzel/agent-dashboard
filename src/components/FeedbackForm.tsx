"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <p className="text-muted-foreground text-sm mt-1">
          TACIT.md has been updated with your learnings.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSuccess(false)}
          className="mt-3"
        >
          Add more feedback
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div>
        <Label className="mb-2 block">Rating</Label>
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
                  : "text-muted-foreground"
              }`}
            >
              {"\u2605"}
            </button>
          ))}
          {rating > 0 && (
            <span className="text-muted-foreground text-sm ml-2">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Feedback text */}
      <div>
        <Label className="mb-2 block">Your Feedback</Label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What do you think of this post? How could it be improved?"
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Learning fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Do more of...</Label>
          <Input
            type="text"
            value={doMore}
            onChange={(e) => setDoMore(e.target.value)}
            placeholder="e.g., personal stories"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Do less of...</Label>
          <Input
            type="text"
            value={doLess}
            onChange={(e) => setDoLess(e.target.value)}
            placeholder="e.g., generic advice"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Try...</Label>
          <Input
            type="text"
            value={tryNew}
            onChange={(e) => setTryNew(e.target.value)}
            placeholder="e.g., ask a question"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </Button>
    </form>
  );
}
