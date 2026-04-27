'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export interface SecondaryNavRailItem {
  href: string;
  label: string;
  status?: string;
  caption?: string;
  meta?: string;
  locked?: boolean;
  dirty?: boolean;
}

function NavItemContent({ item }: { item: SecondaryNavRailItem }) {
  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{item.label}</span>
            {item.dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
          </div>
          {item.caption ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.caption}</p> : null}
        </div>
        {item.status ? <StatusBadge status={item.status} compact className="mt-0.5 shrink-0" /> : null}
      </div>
      {item.meta ? <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">{item.meta}</p> : null}
    </>
  );
}

export function SecondaryNavRail({
  title,
  items,
}: {
  title: string;
  items: SecondaryNavRailItem[];
}) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden lg:block lg:min-h-screen lg:border-r lg:border-border/70 lg:bg-muted/15">
        <div className="sticky top-0 flex min-h-screen flex-col px-3 py-6">
          <div className="px-3 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          </div>
          <nav className="space-y-1.5">
            {items.map((item) => {
              const active = pathname === item.href;

              return item.locked ? (
                <div
                  key={item.href}
                  className="rounded-lg px-3 py-2.5 text-muted-foreground/55"
                  aria-disabled="true"
                >
                  <NavItemContent item={item} />
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <NavItemContent item={item} />
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur lg:hidden sm:px-6">
        <div className="mb-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return item.locked ? (
              <div
                key={item.href}
                className="shrink-0 rounded-full border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground/65"
              >
                {item.label}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {item.dirty ? <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
                  {item.status ? <StatusBadge status={item.status} compact className="hidden sm:inline-flex" /> : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
