"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "DB" },
  { href: "/deliverables", label: "Deliverables", icon: "DL" },
  { href: "/research", label: "Research", icon: "RS" },
  { href: "/x-posts", label: "X Posts", icon: "XP" },
  { href: "/youtube-videos", label: "YouTube Videos", icon: "YT" },
  { href: "/timeline", label: "Timeline", icon: "TL" },
  { href: "/agents", label: "Agents", icon: "AG" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center justify-between px-4 h-16">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="-ml-1 min-w-[48px] min-h-[48px]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span className="text-3xl leading-none">{mobileOpen ? "\u2715" : "\u2630"}</span>
        </Button>
        <h1 className="text-foreground font-bold text-xl tracking-tight">
          Agent Dashboard
        </h1>
        <div className="w-12" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 w-64 bg-background border-r border-border h-screen flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:w-56"
        )}
      >
        <div className="p-5">
          <h1 className="text-foreground font-bold text-xl tracking-tight">
            Agent Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Agent Team Hub</p>
        </div>
        <Separator />

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors min-h-[48px]",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1 text-[10px] font-semibold leading-none tracking-wide">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Separator />
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground text-sm">System Active</span>
          </div>
        </div>
      </aside>
    </>
  );
}
