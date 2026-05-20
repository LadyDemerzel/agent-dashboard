"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
}

function DialogOverlay({ open, className, children, ...props }: DialogOverlayProps) {
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  if (!open) return null;
  if (!portalContainer) return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm", className)}
      {...props}
    >
      {children}
    </div>,
    portalContainer
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, size = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-card p-6 shadow-lg",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-md",
        size === "lg" && "max-w-lg",
        className
      )}
      {...props}
    />
  )
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1.5", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

export { DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
