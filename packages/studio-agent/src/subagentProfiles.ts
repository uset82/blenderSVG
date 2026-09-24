export interface AgentProfile {
  name: string;
  tools: string[];
  body: string;
}

export function parseAgentProfile(markdown: string): AgentProfile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(markdown.trim());
  if (!match?.[1] || match[2] === undefined) throw new Error("An agent profile needs front matter.");
  const front = match[1];
  const name = /^name:\s*(.+)$/m.exec(front)?.[1]?.trim();
  const tools =
    /^tools:\s*(.+)$/m
      .exec(front)?.[1]
      ?.split(",")
      .map((tool) => tool.trim())
      .filter(Boolean) ?? [];
  if (!name) throw new Error("An agent profile needs a name.");
  return { name, tools, body: match[2].trim() };
}

export function canStartSubagent(depth: number): boolean {
  return depth < 1;
}
