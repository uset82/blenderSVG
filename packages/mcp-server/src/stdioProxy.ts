export interface StdioProxyTarget {
  url: string;
  token: string;
}

export function stdioProxyTarget(env: NodeJS.ProcessEnv = process.env): StdioProxyTarget {
  const token = env.BLENDERSVG_MCP_TOKEN?.trim() ?? "";
  if (!token) throw new Error("Set BLENDERSVG_MCP_TOKEN before starting the stdio proxy.");
  const url = new URL(env.BLENDERSVG_MCP_URL?.trim() || "http://127.0.0.1:8787/mcp");
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.protocol !== "http:" || !loopback) {
    throw new Error("The stdio proxy only forwards to a loopback http MCP endpoint.");
  }
  return { url: url.toString(), token };
}

export async function forwardStdioMessage(
  target: StdioProxyTarget,
  body: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl(target.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${target.token}`,
      "content-type": "application/json"
    },
    body
  });
  return response.text();
}

export async function runStdioProxy(
  lines: AsyncIterable<string>,
  write: (line: string) => void,
  target: StdioProxyTarget,
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  let forwarded = 0;
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const text = await forwardStdioMessage(target, trimmed, fetchImpl);
    write(text.endsWith("\n") ? text : `${text}\n`);
    forwarded += 1;
  }
  return forwarded;
}
