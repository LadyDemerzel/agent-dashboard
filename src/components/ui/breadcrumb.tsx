import Link from 'next/link';
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn('flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden text-sm leading-none text-muted-foreground', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('inline-flex min-w-0 shrink items-center gap-1.5 align-middle leading-none', className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={cn('inline-flex max-w-full items-center truncate align-middle leading-none transition-colors hover:text-foreground', className)} {...props} />;
}

export function BreadcrumbPage({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-current="page" className={cn('inline-flex max-w-full items-center truncate align-middle font-medium leading-none text-foreground', className)} {...props}>
      {children}
    </span>
  );
}

export function BreadcrumbSeparator({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center leading-none text-muted-foreground/60', className)} {...props}>
      {children ?? '/'}
    </span>
  );
}

export function BreadcrumbEllipsis({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('inline-flex items-center text-muted-foreground', className)} {...props}>
      {children ?? '…'}
    </span>
  );
}

export function BreadcrumbCurrentLabel({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
