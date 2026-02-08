import Link from "next/link";
import { getResearchFiles } from "@/lib/research";
import { ResearchStats, ResearchList } from "@/components/ResearchCard";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const files = getResearchFiles();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📡</span>
          <h1 className="text-2xl font-bold text-white">Research</h1>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Echo&apos;s X research and market analysis
        </p>
      </div>

      {/* Stats */}
      <ResearchStats files={files} />

      {/* Research Files List */}
      <ResearchList files={files} />
    </div>
  );
}
