"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
        <Label>Status:</Label>
        <Select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={submitting}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <p className="text-emerald-400 text-sm mt-2">{success}</p>
      )}
      {error && !showModal && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}

      {/* Feedback Modal */}
      <DialogOverlay open={showModal}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Describe what should be improved. The agent will receive this
              feedback and revise automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleModalSubmit} className="space-y-4">
            <div>
              <Label className="block mb-2">Feedback</Label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="What needs to change? Be specific..."
                rows={5}
                autoFocus
                className="resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowModal(false);
                  setSelectedStatus(currentStatus);
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="warning"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send Feedback"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogOverlay>
    </div>
  );
}
