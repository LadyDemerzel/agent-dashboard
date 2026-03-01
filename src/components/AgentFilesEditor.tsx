"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            title={tab.description}
          >
            {tab.label}
          </Button>
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
        <Textarea
          value={getCurrentContent()}
          onChange={(e) => updateContent(activeTab, e.target.value)}
          className="h-[500px] rounded-xl p-4 text-foreground font-mono leading-relaxed resize-none"
          spellCheck={false}
          placeholder={`Enter content for ${getFileName()}...`}
        />
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-xs">
            {TABS.find((t) => t.id === activeTab)?.description}
          </p>
          <Button
            onClick={() => handleSave(getFileName(), getCurrentContent())}
            disabled={saving}
          >
            {saving ? "Saving..." : `Save ${getFileName()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
