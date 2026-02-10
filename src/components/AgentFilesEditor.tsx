"use client";

import { useState } from "react";

interface AgentFilesEditorProps {
  agentId: string;
  soul: string;
  agents: string;
  user: string;
  tools: string;
  heartbeat: string;
  identity: string;
  memory: string;
}

type TabId = "soul" | "agents" | "user" | "tools" | "heartbeat" | "identity" | "memory";

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  { id: "soul", label: "SOUL.md", description: "Identity/persona" },
  { id: "agents", label: "AGENTS.md", description: "Operating procedures" },
  { id: "user", label: "USER.md", description: "Who the agent helps" },
  { id: "tools", label: "TOOLS.md", description: "Tool configurations" },
  { id: "heartbeat", label: "HEARTBEAT.md", description: "Proactive task guide" },
  { id: "identity", label: "IDENTITY.md", description: "Agent identity info" },
  { id: "memory", label: "MEMORY.md", description: "Working memory and context" },
];

export function AgentFilesEditor({
  agentId,
  soul,
  agents,
  user,
  tools,
  heartbeat,
  identity,
  memory,
}: AgentFilesEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("soul");
  const [contents, setContents] = useState({
    soul,
    agents,
    user,
    tools,
    heartbeat,
    identity,
    memory,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave(fileName: string, content: string) {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileName, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage(`${fileName} saved successfully.`);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Failed to save"}`
      );
    } finally {
      setSaving(false);
    }
  }

  const updateContent = (tabId: TabId, value: string) => {
    setContents((prev) => ({ ...prev, [tabId]: value }));
  };

  const getCurrentContent = () => contents[activeTab];

  const getFileName = () => `${activeTab.toUpperCase()}.md`;

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
            title={tab.description}
          >
            {tab.label}
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

      {/* Editor */}
      <div className="space-y-3">
        <textarea
          value={getCurrentContent()}
          onChange={(e) => updateContent(activeTab, e.target.value)}
          className="w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm font-mono leading-relaxed focus:border-zinc-600 focus:outline-none resize-none"
          spellCheck={false}
          placeholder={`Enter content for ${getFileName()}...`}
        />
        <div className="flex justify-between items-center">
          <p className="text-zinc-600 text-xs">
            {TABS.find((t) => t.id === activeTab)?.description}
          </p>
          <button
            onClick={() => handleSave(getFileName(), getCurrentContent())}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {saving ? "Saving..." : `Save ${getFileName()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
