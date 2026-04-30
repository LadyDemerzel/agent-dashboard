"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { EditIconButton } from "@/components/EditIconButton";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CompactSettingValueTone = "primary" | "secondary" | "foreground";

export type CompactSettingValueLine = {
  children: ReactNode;
  tone?: CompactSettingValueTone;
  className?: string;
};

type CompactSettingDialog = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

export function CompactSettingValue({
  children,
  className,
  tone = "primary",
}: {
  children: ReactNode;
  className?: string;
  tone?: CompactSettingValueTone;
}) {
  const toneClass =
    tone === "foreground"
      ? "text-foreground"
      : tone === "secondary"
        ? "text-white/90"
        : "text-white";

  return (
    <div
      className={cn(
        "min-w-0 break-words text-sm font-semibold leading-tight [overflow-wrap:anywhere]",
        toneClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CompactSettingLink({
  className,
  ...props
}: LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>) {
  return (
    <Link
      {...props}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center justify-end whitespace-normal break-words text-right text-xs leading-tight text-muted-foreground hover:text-foreground [overflow-wrap:anywhere]",
        className,
      )}
    />
  );
}

export function CompactSettingCard({
  title,
  globalDefault,
  valueLines,
  links,
  editTooltip,
  onEdit,
  editDisabled = false,
  editButtonClassName,
  dialog,
}: {
  title: ReactNode;
  globalDefault?: ReactNode;
  valueLines: CompactSettingValueLine[];
  links?: ReactNode;
  editTooltip?: string;
  onEdit?: () => void;
  editDisabled?: boolean;
  editButtonClassName?: string;
  dialog?: CompactSettingDialog;
}) {
  const hasEdit = Boolean(editTooltip && onEdit);

  return (
    <>
      <div className="rounded-lg border border-border bg-background/60 p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h3 className="min-w-0 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {title}
            </h3>
          </div>
          <div className="flex min-w-0 items-start justify-end gap-2 text-right">
            <div className="min-w-0 flex-1 space-y-0.5 leading-tight">
              {valueLines.map((line, index) => (
                <CompactSettingValue
                  key={index}
                  tone={line.tone}
                  className={line.className}
                >
                  {line.children}
                </CompactSettingValue>
              ))}
            </div>
            {hasEdit ? (
              <EditIconButton
                tooltip={editTooltip}
                onClick={onEdit}
                disabled={editDisabled}
                className={cn(
                  "h-8 w-8 shrink-0 cursor-pointer disabled:cursor-not-allowed",
                  editButtonClassName,
                )}
              />
            ) : null}
          </div>
          <div className="min-w-0 text-left leading-tight">
            {globalDefault ? (
              <p className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {globalDefault}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 justify-end self-start text-right">
            {links ? (
              <div className="flex max-w-full min-w-0 flex-wrap justify-end gap-3">
                {links}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {dialog ? (
        <DialogOverlay open={dialog.open}>
          <DialogContent size={dialog.size || "md"}>
            <DialogHeader>
              <DialogTitle>{dialog.title}</DialogTitle>
              {dialog.description ? (
                <DialogDescription>{dialog.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="space-y-4">{dialog.children}</div>
          </DialogContent>
        </DialogOverlay>
      ) : null}
    </>
  );
}
