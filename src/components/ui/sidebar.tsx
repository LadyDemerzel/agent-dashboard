import Link from 'next/link';
import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Sidebar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn('flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground', className)}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex shrink-0 flex-col gap-3 border-b border-sidebar-border px-3 py-3', className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3', className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shrink-0 border-t border-sidebar-border px-3 py-3', className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('space-y-2', className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground', className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1', className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('space-y-1', className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('list-none', className)} {...props} />;
}

export function SidebarMenuLink({
  className,
  isActive = false,
  compact = false,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  isActive?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl text-sm font-medium transition-colors',
        compact
          ? 'h-10 justify-center px-0'
          : 'min-h-11 px-3 py-2.5',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]'
          : 'text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground',
        className
      )}
      {...props}
    />
  );
}

export function SidebarMenuButton({
  className,
  isActive = false,
  compact = false,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  isActive?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      className={cn(
        'group inline-flex items-center gap-2 rounded-xl text-sm font-medium transition-colors',
        compact
          ? 'h-10 w-10 justify-center'
          : 'min-h-10 w-full px-3 py-2',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground',
        className
      )}
      {...props}
    />
  );
}
