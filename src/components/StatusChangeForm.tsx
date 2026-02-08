"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StatusChangeFormProps {
  currentStatus: string;
  itemId: string;
  itemType: "research" | "x-post";
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "text-zinc-400" },
  { value: "needs review", label: "Needs Review", color: "text-amber-400" },
  {
    value: "requested changes",
    label: "Requested Changes",
    color: "text-orange-400",
  },
  { value: "approved", label: "Approved", color: "text-emerald-400" },
  { value: "published", label: "Published", color: "text-blue-400" },
];

export function StatusChangeForm({
  currentStatus,
  itemId,
  itemType,
}: StatusChangeFormProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [showModal, setShowModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleStatusChange(newStatus: string) {
    setSelectedStatus(newStatus);
    if (newStatus === "requested changes") {
      setShowModal(true);
    } else if (newStatus !== currentStatus) {
      submitStatusChange(newStatus, "");
    }
  }

  async function submitStatusChange(status: string, note: string) {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const apiBase =
        itemType === "research"
          ? `/api/research/${itemId}/feedback`
          : `/api/x-posts/${itemId}/feedback`;

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          feedback: note,
          note: note || `Status changed to ${status}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      setSuccess(
        status === "requested changes"
          ? "Feedback sent! Agent will revise and resubmit."
          : `Status updated to "${status}".`
      );
      setShowModal(false);
      setFeedbackText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) {
      setError("Please provide feedback for the agent.");
      return;
    }
    submitStatusChange("requested changes", feedbackText);
  }

  return (
    <div>
      {/* Status Dropdown */}
      <div className="flex items-center gap-3">
        <label className="text-zinc-500 text-sm">Status:</label>
        <select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={submitting}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <p className="text-emerald-400 text-sm mt-2">{success}</p>
      )}
      {error && !showModal && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}

      {/* Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-white font-semibold text-lg mb-1">
              Request Changes
            </h3>
            <p className="text-zinc-500 text-sm mb-4">
              Describe what should be improved. The agent will receive this
              feedback and revise automatically.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-2">
                  Feedback
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What needs to change? Be specific..."
                  rows={5}
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none resize-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedStatus(currentStatus);
                    setError("");
                  }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
