"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ValidationNotice } from "@/components/short-form-video/WorkflowShared";
import {
  getShortFormAutoRunCurrentStep,
  getShortFormAutoRunStepLabel,
  getShortFormAutoRunSubsequentSteps,
  type ShortFormAutoRunStepId,
} from "@/lib/short-form-auto-run";
import type { ShortFormProjectClient as Project } from "@/lib/short-form-video-client";
import type { ShortFormDetailRouteSection } from "@/lib/short-form-video-navigation";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function parseEnvelope<T>(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || fallback);
  }
  return payload;
}

async function postJson<T>(
  url: string,
  body?: Record<string, unknown>,
  fallback = "Request failed",
) {
  return parseEnvelope<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
    fallback,
  );
}

async function deleteJson<T>(url: string, fallback = "Request failed") {
  return parseEnvelope<T>(
    await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),
    fallback,
  );
}

function buildStatusText(project: Project) {
  const autoRun = project.autoRun;
  if (!autoRun) return null;

  if (autoRun.status === "active") {
    return autoRun.currentStep
      ? `Auto-run active: ${getShortFormAutoRunStepLabel(autoRun.currentStep)}`
      : "Auto-run active";
  }

  if (autoRun.status === "completed") return "Auto-run complete";
  if (autoRun.status === "stopped") return "Auto-run stopped";
  if (autoRun.status === "failed") {
    const step = autoRun.failedStep
      ? `${getShortFormAutoRunStepLabel(autoRun.failedStep)} failed`
      : "Auto-run failed";
    return autoRun.error ? `${step}: ${autoRun.error}` : step;
  }

  return null;
}

export function AutoGenerateRestButton({
  project,
  activeSection,
  onProjectRefresh,
}: {
  project: Project;
  activeSection: ShortFormDetailRouteSection;
  onProjectRefresh: () => Promise<unknown>;
}) {
  const subsequentSteps = useMemo(
    () => getShortFormAutoRunSubsequentSteps(activeSection),
    [activeSection],
  );
  const currentStep = useMemo(
    () => getShortFormAutoRunCurrentStep(activeSection),
    [activeSection],
  );
  const [selectedStepIds, setSelectedStepIds] = useState<ShortFormAutoRunStepId[]>(
    () => subsequentSteps.map((step) => step.id),
  );
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelectedStepIds(subsequentSteps.map((step) => step.id));
    setError(null);
  }, [subsequentSteps]);

  async function startAutoRun(selectedSteps?: ShortFormAutoRunStepId[]) {
    if (starting || project.autoRun?.status === "active") return;

    setStarting(true);
    setError(null);

    try {
      await postJson(`/api/short-form-videos/${project.id}/auto-run`, {
        startedFrom: activeSection,
        ...(selectedSteps ? { selectedSteps } : {}),
      }, "Failed to start auto-run");
      await onProjectRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start auto-run");
      await onProjectRefresh().catch(() => undefined);
    } finally {
      setStarting(false);
    }
  }

  async function stopAutoRun() {
    if (stopping || project.autoRun?.status !== "active") return;

    setStopping(true);
    setError(null);

    try {
      await deleteJson(`/api/short-form-videos/${project.id}/auto-run`, "Failed to stop auto-run");
      await onProjectRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop auto-run");
      await onProjectRefresh().catch(() => undefined);
    } finally {
      setStopping(false);
    }
  }

  const selectedSteps = subsequentSteps.filter((step) =>
    selectedStepIds.includes(step.id),
  );
  const allSelected =
    subsequentSteps.length > 0 && selectedStepIds.length === subsequentSteps.length;
  const autoRunActive = project.autoRun?.status === "active";
  const busy = starting || stopping;
  const statusText = buildStatusText(project);

  function toggleStep(stepId: ShortFormAutoRunStepId) {
    setSelectedStepIds((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="inline-flex rounded-md shadow-sm">
        <Button
          type="button"
          onClick={() => void startAutoRun()}
          disabled={busy || autoRunActive}
          className="rounded-r-none"
        >
          {starting || autoRunActive ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : null}
          Auto-generate rest of video from here
        </Button>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label="Choose auto-run workflow steps"
              disabled={busy || autoRunActive}
              className="rounded-l-none border-l border-zinc-300 px-3"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(24rem,calc(100vw-2rem))] p-3"
          >
            <div className="space-y-3">
              {currentStep ? (
                <p className="rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                  {currentStep.label} will be prepared first. Choose which later steps to run after it.
                </p>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelectedStepIds(
                      allSelected ? [] : subsequentSteps.map((step) => step.id),
                    )
                  }
                  className="h-4 w-4"
                />
                <span>Toggle all subsequent steps</span>
              </label>
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {subsequentSteps.length > 0 ? (
                  subsequentSteps.map((step) => (
                    <label
                      key={step.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStepIds.includes(step.id)}
                        onChange={() => toggleStep(step.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>{step.label}</span>
                    </label>
                  ))
                ) : (
                  <p className="rounded-md border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                    There are no later workflow steps after this page.
                  </p>
                )}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={busy || autoRunActive || (!currentStep && selectedSteps.length === 0)}
                onClick={() => {
                  setOpen(false);
                  void startAutoRun(selectedStepIds);
                }}
              >
                Auto-run selected steps
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {autoRunActive ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void stopAutoRun()}
            disabled={stopping}
            className="ml-2"
          >
            {stopping ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Square aria-hidden="true" className="h-4 w-4" />
            )}
            Stop
          </Button>
        ) : null}
      </div>
      {statusText ? (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      ) : null}
      {error ? (
        <ValidationNotice
          title="Auto-run issue"
          message={error}
          className="max-w-xl"
        />
      ) : null}
    </div>
  );
}
