import { describe, expect, it } from "vitest";
import { forwardStdioMessage, runStdioProxy, stdioProxyTarget } from "../src/stdioProxy.js";

describe("stdio mcp proxy", () => {
  it("requires a token and a loopback endpoint", async () => {
    expect(() => stdioProxyTarget({})).toThrow(/BLENDERSVG_MCP_TOKEN/);
    expect(() =>
      stdioProxyTarget({ BLENDERSVG_MCP_TOKEN: "secret", BLENDERSVG_MCP_URL: "https://example.com/mcp" })
    ).toThrow(/loopback/);
    expect(stdioProxyTarget({ BLENDERSVG_MCP_TOKEN: "secret" })).toEqual({
      url: "http://127.0.0.1:8787/mcp",
      token: "secret"
    });
    let authorization = "";
    const text = await forwardStdioMessage(
      { url: "http://127.0.0.1:8787/mcp", token: "secret" },
      '{"jsonrpc":"2.0"}',
      (async (_url, init) => {
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response("ok");
      }) as typeof fetch
    );
    expect(authorization).toBe("Bearer secret");
    expect(text).toBe("ok");
    const written: string[] = [];
    const count = await runStdioProxy(
      (async function* () {
        yield "\n";
        yield '{"method":"tools/list"}\n';
      })(),
      (line) => written.push(line),
      { url: "http://127.0.0.1:8787/mcp", token: "secret" },
      (async () => new Response("listed")) as typeof fetch
    );
    expect(count).toBe(1);
    expect(written).toEqual(["listed\n"]);
  });
});
