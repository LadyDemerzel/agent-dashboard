"use client";

import { useState } from "react";

interface GuidelinesEditorProps {
  agentId: string;
  soul: string;
  agents: string;
  tacit: string;
}

type Tab = "soul" | "agents" | "tacit";

export function GuidelinesEditor({
  agentId,
  soul,
  agents,
  tacit,
}: GuidelinesEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>("soul");
  const [soulContent, setSoulContent] = useState(soul);
  const [agentsContent, setAgentsContent] = useState(agents);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave(file: "SOUL.md" | "AGENTS.md", content: string) {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/guidelines/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage(`${file} saved successfully.`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Failed to save"}`
      );
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; editable: boolean }[] = [
    { id: "soul", label: "SOUL.md", editable: true },
    { id: "agents", label: "AGENTS.md", editable: true },
    { id: "tacit", label: "TACIT.md", editable: false },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
          >
            {tab.label}
            {!tab.editable && (
              <span className="ml-1.5 text-xs text-zinc-600">(read-only)</span>
            )}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <p
          className={`text-sm mb-3 ${message.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}
        >
          {message}
        </p>
      )}

      {/* Editor Panels */}
      {activeTab === "soul" && (
        <div className="space-y-3">
          <textarea
            value={soulContent}
            onChange={(e) => setSoulContent(e.target.value)}
            className="w-full h-[600px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm font-mono leading-relaxed focus:border-zinc-600 focus:outline-none resize-none"
            spellCheck={false}
          />
          <div className="flex justify-end">
            <button
              onClick={() => handleSave("SOUL.md", soulContent)}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {saving ? "Saving..." : "Save SOUL.md"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "agents" && (
        <div className="space-y-3">
          <textarea
            value={agentsContent}
            onChange={(e) => setAgentsContent(e.target.value)}
            className="w-full h-[600px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm font-mono leading-relaxed focus:border-zinc-600 focus:outline-none resize-none"
            spellCheck={false}
          />
          <div className="flex justify-end">
            <button
              onClick={() => handleSave("AGENTS.md", agentsContent)}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {saving ? "Saving..." : "Save AGENTS.md"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "tacit" && (
        <div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <pre className="text-zinc-300 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              {tacit || "No learnings recorded yet."}
            </pre>
          </div>
          <p className="text-zinc-600 text-xs mt-2">
            TACIT.md is auto-updated from feedback. It cannot be edited manually.
          </p>
        </div>
      )}
    </div>
  );
}
