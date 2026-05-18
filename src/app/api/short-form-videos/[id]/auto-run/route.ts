import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormAutoRunJob,
  startShortFormAutoRun,
  stopShortFormAutoRun,
} from "@/lib/short-form-auto-run-orchestrator";
import { isShortFormAutoRunStepId } from "@/lib/short-form-auto-run";
import {
  isShortFormDetailRouteSection,
  type ShortFormDetailRouteSection,
} from "@/lib/short-form-video-navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseStartedFrom(value: unknown): ShortFormDetailRouteSection {
  return typeof value === "string" && isShortFormDetailRouteSection(value)
    ? value
    : "topic";
}

function parseSelectedSteps(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  return value.filter((item) => {
    if (!isShortFormAutoRunStepId(item) || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const autoRun = getShortFormAutoRunJob(id);
  return NextResponse.json({ success: true, data: autoRun });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const autoRun = startShortFormAutoRun({
      projectId: id,
      baseUrl: request.nextUrl.origin,
      startedFrom: parseStartedFrom(body.startedFrom),
      selectedSubsequentSteps: parseSelectedSteps(body.selectedSteps),
    });

    return NextResponse.json({ success: true, data: autoRun }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start auto-run";
    const status = /already active/i.test(message) ? 409 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const autoRun = stopShortFormAutoRun(id);
  return NextResponse.json({ success: true, data: autoRun });
}
