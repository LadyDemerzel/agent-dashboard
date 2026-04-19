'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export interface SectionNavigatorItem<T extends string = string> {
  id: T;
  label: string;
  available?: boolean;
  unavailableLabel?: string;
  dirty?: boolean;
  status?: string;
}

function getAvailableSections<T extends string>(sections: SectionNavigatorItem<T>[]) {
  return sections.filter((section) => section.available !== false);
}

export function useSectionScrollSpy<T extends string>(sections: SectionNavigatorItem<T>[]) {
  const [activeSection, setActiveSection] = useState<T | null>(null);

  useEffect(() => {
    const availableSections = getAvailableSections(sections);

    if (availableSections.length === 0) {
      const frame = window.requestAnimationFrame(() => setActiveSection(null));
      return () => window.cancelAnimationFrame(frame);
    }

    const sectionElements = availableSections
      .map((section) => ({ id: section.id, element: document.getElementById(section.id) }))
      .filter((section): section is { id: T; element: HTMLElement } => Boolean(section.element));

    if (sectionElements.length === 0) {
      const frame = window.requestAnimationFrame(() => setActiveSection(availableSections[0].id));
      return () => window.cancelAnimationFrame(frame);
    }

    let ticking = false;
    let frame = 0;

    const updateActiveSection = () => {
      ticking = false;

      const viewportAnchor = window.scrollY + Math.min(160, Math.max(window.innerHeight * 0.25, 96));
      const nearPageBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;

      if (nearPageBottom) {
        setActiveSection(sectionElements[sectionElements.length - 1].id);
        return;
      }

      let nextActive = sectionElements[0].id;

      for (const section of sectionElements) {
        const sectionTop = section.element.getBoundingClientRect().top + window.scrollY;
        if (sectionTop <= viewportAnchor) {
          nextActive = section.id;
        } else {
          break;
        }
      }

      setActiveSection(nextActive);
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [sections]);

  return activeSection;
}

export function SectionNavigator<T extends string>({
  sections,
  activeSection,
}: {
  sections: SectionNavigatorItem<T>[];
  activeSection: T | null;
}) {
  const availableSections = getAvailableSections(sections);

  function scrollToSection(sectionId: T) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (availableSections.length <= 1) {
    return null;
  }

  return (
    <div>
      <Card className="fixed right-6 top-24 z-20 hidden w-56 border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur xl:block">
        <div className="mb-2 px-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">On this page</p>
        </div>
        <nav className="space-y-1">
          {availableSections.map((section) => {
            const isActive = section.id === activeSection;
            const isAvailable = section.available !== false;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                disabled={!isAvailable}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  isAvailable
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/45',
                  isActive && isAvailable && 'bg-muted text-foreground'
                )}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{section.label}</span>
                  {section.dirty ? <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1.5">
                  {section.status ? <StatusBadge status={section.status} compact /> : null}
                  {!isAvailable && section.unavailableLabel ? (
                    <span className="text-[11px] uppercase tracking-wide">{section.unavailableLabel}</span>
                  ) : section.dirty ? (
                    <span className="text-[11px] uppercase tracking-wide text-amber-200">Unsaved</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pt-2 pb-[env(safe-area-inset-bottom)] md:left-56 xl:hidden">
        <Card className="mx-auto max-w-full rounded-b-none border-b-0 border-border/80 bg-background/95 px-2 pt-2 pb-0 shadow-[0_-12px_24px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-0">
            {availableSections.map((section) => {
              const isActive = section.id === activeSection;
              const isAvailable = section.available !== false;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  disabled={!isAvailable}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    isAvailable
                      ? 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      : 'border-border/60 bg-muted/40 text-muted-foreground/45',
                    isActive && isAvailable && 'border-primary/40 bg-primary/10 text-foreground'
                  )}
                  aria-current={isActive ? 'location' : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{section.label}</span>
                    {section.status ? <StatusBadge status={section.status} compact className="hidden sm:inline-flex" /> : null}
                    {section.dirty ? <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
