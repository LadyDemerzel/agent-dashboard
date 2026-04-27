"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrbitLoader } from "@/components/ui/loading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export function WorkflowArtifactActionButton({
  hasArtifact,
  initialLabel,
  rerunLabel,
  rerunWithNotesLabel,
  loadingLabel = "Working…",
  notesPlaceholder = "Enter revision instructions to incorporate",
  disabled = false,
  loading = false,
  onInitialRun,
  onCleanRerun,
  onRerunWithNotes,
}: {
  hasArtifact: boolean;
  initialLabel: string;
  rerunLabel: string;
  rerunWithNotesLabel: string;
  loadingLabel?: string;
  notesPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onInitialRun: () => void | Promise<void>;
  onCleanRerun: () => void | Promise<void>;
  onRerunWithNotes: (notes: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonGroupRef = useRef<HTMLDivElement | null>(null);
  const textareaId = `${rerunWithNotesLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-notes`;
  const isDisabled = disabled || loading;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonGroupRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function submitRevisionNotes() {
    await onRerunWithNotes(notes);
    setNotes("");
    setOpen(false);
  }

  if (!hasArtifact) {
    return (
      <Button
        onClick={() => void onInitialRun()}
        disabled={isDisabled}
        className="cursor-pointer"
      >
        {loading ? loadingLabel : initialLabel}
      </Button>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-start">
      <div ref={buttonGroupRef} className="inline-flex rounded-md shadow-sm">
        <Button
          type="button"
          onClick={() => void onCleanRerun()}
          disabled={isDisabled}
          className="cursor-pointer rounded-r-none"
        >
          {loading ? loadingLabel : rerunLabel}
        </Button>
        <Button
          type="button"
          aria-label={`Open revision notes for ${rerunLabel.toLowerCase()}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          disabled={isDisabled}
          className="cursor-pointer rounded-l-none border-l border-primary-foreground/20 px-3"
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Button>
      </div>
      {open ? (
        <Card
          ref={panelRef}
          role="dialog"
          aria-label={`${rerunLabel} revision notes`}
          className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 border-border/80 bg-secondary p-3 shadow-2xl shadow-black/50"
        >
          <div className="space-y-2">
            <Label htmlFor={textareaId} className="sr-only">
              Revision instructions
            </Label>
            <Textarea
              id={textareaId}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={notesPlaceholder}
              className="min-h-[96px]"
              autoFocus
            />
          </div>
          <Button
            type="button"
            className="w-full cursor-pointer"
            onClick={() => void submitRevisionNotes()}
            disabled={isDisabled || !notes.trim()}
          >
            {loading ? loadingLabel : rerunWithNotesLabel}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

export function ShortFormSubpageHeader({
  eyebrow,
  title,
  description,
  status,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  status?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-4xl">
        {eyebrow ? (
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {status || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {status ? <StatusBadge status={status} /> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function ShortFormSubpageShell({
  eyebrow,
  title,
  description,
  status,
  actions,
  preContent,
  children,
  className,
  contentClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  status?: string;
  actions?: ReactNode;
  preContent?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn("space-y-6 p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8", className)}
    >
      <ShortFormSubpageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        status={status}
        actions={actions}
      />
      {preContent}
      <div className={cn("min-w-0 space-y-6", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function WorkflowSectionHeader({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

export function ValidationNotice({
  title = "Validation error",
  message,
  className,
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100",
        className,
      )}
      role="alert"
    >
      <p className="font-medium text-red-200">{title}</p>
      <p className="mt-1 text-red-100/90">{message}</p>
    </div>
  );
}

export function PendingNotice({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <OrbitLoader label={label} />
      {hint ? (
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function RevisionRequestNotice({
  title,
  requestText,
  requestedAt,
  pending,
  warning,
}: {
  title: string;
  requestText?: string;
  requestedAt?: string;
  pending: boolean;
  warning?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        pending
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/25 bg-amber-500/10",
      )}
    >
      <div className="space-y-3">
        {pending ? (
          <OrbitLoader label={title} />
        ) : (
          <p className="text-sm font-medium text-amber-100">{title}</p>
        )}
        <div className="space-y-2 text-sm">
          {requestedAt ? (
            <p className="text-muted-foreground">
              Requested {new Date(requestedAt).toLocaleString()}
            </p>
          ) : null}
          {requestText ? (
            <div className="rounded-md border border-border/60 bg-background/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Latest requested changes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-foreground">
                {requestText}
              </p>
            </div>
          ) : null}
          {warning ? <p className="text-amber-100">{warning}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function StaleArtifactNotice({
  updatedAt,
  label,
}: {
  updatedAt?: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-50">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-amber-50/80">
        {updatedAt
          ? `Showing the current on-disk version from ${new Date(updatedAt).toLocaleString()}. A newer revision has not been written yet.`
          : "Showing the current on-disk version. A newer revision has not been written yet."}
      </p>
    </div>
  );
}

export function StageReviewControls({
  status,
  note,
  saving,
  pending,
  editing,
  showEditButton = true,
  onStatusChange,
  onNoteChange,
  onApply,
  onToggleEdit,
}: {
  status: string;
  note: string;
  saving: boolean;
  pending?: boolean;
  editing: boolean;
  showEditButton?: boolean;
  onStatusChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onApply: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="needs review">Needs Review</option>
            {status === "requested changes" ? (
              <option value="requested changes">Requested Changes</option>
            ) : null}
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </Select>
        </div>
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional status note"
          className="flex-1"
        />
        <Button onClick={onApply} disabled={saving}>
          Apply status
        </Button>
        {showEditButton ? (
          <Button variant="outline" onClick={onToggleEdit}>
            {editing ? "Cancel edit" : "Edit"}
          </Button>
        ) : null}
      </div>
      {pending ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground">
          Waiting for the latest workflow run to land.
        </div>
      ) : null}
    </div>
  );
}
