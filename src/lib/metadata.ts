import type { Metadata } from "next";

export const DASHBOARD_APP_NAME = "Agent Dashboard";
export const DEFAULT_DASHBOARD_PAGE_TITLE = "Dashboard Overview";
export const DEFAULT_DASHBOARD_DESCRIPTION = "Coordination hub for the agent team";

export function createPageMetadata(title: string, description?: string): Metadata {
  return description ? { title, description } : { title };
}

export function createEntityPageTitle(label: string, value?: string | null): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? `${label}: ${normalizedValue}` : label;
}
