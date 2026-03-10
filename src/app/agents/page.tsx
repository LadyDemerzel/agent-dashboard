"use client";

import { useRouter } from "next/navigation";
import { AGENTS } from "@/lib/agents";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="mb-1">
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage agent configurations and view their workspace files
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead className="min-w-[320px]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {AGENTS.map((agent) => (
              <TableRow
                key={agent.id}
                tabIndex={0}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => router.push(`/agents/${agent.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/agents/${agent.id}`);
                  }
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium"
                      style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                    >
                      {agent.icon}
                    </div>
                    <div className="font-medium text-foreground">{agent.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{agent.domain}</TableCell>
                <TableCell className="text-muted-foreground">
                  {agent.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
