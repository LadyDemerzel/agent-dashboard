import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
}

function DialogOverlay({ open, className, children, ...props }: DialogOverlayProps) {
  if (!open) return null;
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60",
        className
      )}
      {...props}
    >
      {children}
    </div>
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
        "bg-zinc-900 border border-zinc-800 rounded-xl p-6 mx-4 w-full",
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
  return (
    <div className={cn("mb-4", className)} {...props} />
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-white font-semibold text-lg", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-zinc-400 text-sm mt-1", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex gap-3 justify-end mt-6", className)}
      {...props}
    />
  );
}

export { DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
