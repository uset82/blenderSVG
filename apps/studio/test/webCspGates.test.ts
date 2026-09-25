import { readFileSync } from "node:fs";
import type { StudioToHostMessageInput } from "@codex-avatar-studio/avatar-core";
import { OPENROUTER_SECRET_KEY } from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldLoadModelCatalog } from "../src/bridge/studioHost.js";
import { assertSvgPathCount } from "../src/components/vtracerPresets.js";
import { TRACE_CANCELLED, tracePixelsInWorker } from "../src/projects/traceWorkerClient.js";
import { beginWebOpenRouterConnect, completeWebOpenRouterConnect } from "../src/web/openRouterConnect.js";
import { createWebHostTransport } from "../src/web/webHostTransport.js";
import { createMemorySecretRecords, setRememberOpenRouterKey, WebSecretStore } from "../src/web/webSecretStore.js";

const secret = "sk-or-v1-csp-gate-secret";
const reply = "Kurva CSP stream payload";
const options = { mode: "spline" as const, preset: "poster" as const, clustering: "color-cluster" as const };
const preprocessing = { quantizationLevels: 6, removeNearWhiteBackground: true as const, noiseReduction: 10 };

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}

function catalogResponse() {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: "kurva/csp-text",
          name: "CSP Text",
          architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          description: "Fixture",
          context_length: 8000,
          pricing: { prompt: "0", completion: "0" },
          supported_parameters: ["max_tokens"]
        }
      ]
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("web CSP gates", () => {
  afterEach(() => {
    setRememberOpenRouterKey(true);
    vi.unstubAllGlobals();
  });

  it("exchanges a code and streams the mock reply only to openrouter.ai", async () => {
    const urls: string[] = [];
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (url === "https://openrouter.ai/api/v1/auth/keys") {
        const body = JSON.parse(String(init?.body)) as {
          code?: string;
          code_verifier?: string;
          code_challenge_method?: string;
        };
        expect(body.code).toBe("auth-code");
        expect(body.code_challenge_method).toBe("S256");
        expect(body.code_verifier?.length).toBeGreaterThan(20);
        return new Response(JSON.stringify({ key: secret }), { status: 200 });
      }
      if (url.startsWith("https://openrouter.ai/api/v1/models/user")) return catalogResponse();
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`,
          {
            status: 200
          }
        );
      }
      throw new Error(`Unexpected OpenRouter URL: ${url}`);
    });
    const storage = memoryStorage();
    let assigned = "";
    await beginWebOpenRouterConnect({
      remember: true,
      returnHash: "#/settings",
      origin: "https://app.kurva.agency",
      storage,
      assign: (url) => {
        assigned = url;
      }
    });
    const callback = new URL(new URL(assigned).searchParams.get("callback_url") ?? "");
    const records = createMemorySecretRecords();
    const secrets = new WebSecretStore(records, () => true);
    await completeWebOpenRouterConnect({
      search: `?code=auth-code&state=${callback.searchParams.get("state")}`,
      storage,
      request,
      secrets,
      replaceUrl: () => undefined
    });
    expect(await secrets.get(OPENROUTER_SECRET_KEY)).toBe(secret);
    const transport = createWebHostTransport({ secrets, request });
    const deltas: string[] = [];
    transport.subscribe((message) => {
      if (message.type === "studio:chatDelta") deltas.push(message.delta);
    });
    transport.send({ type: "studio:ready" });
    const chat: StudioToHostMessageInput = {
      type: "studio:chatRequest",
      requestId: "csp-chat",
      modelId: "kurva/csp-text",
      history: [],
      userMessage: "Hello"
    };
    transport.send(chat);
    await vi.waitFor(() => expect(deltas.join("")).toBe(reply));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => new URL(url).origin === "https://openrouter.ai")).toBe(true);
  });

  it("rejects 20001 paths and cancels an in-flight trace through the shipped client", async () => {
    const paths = "<path d='M0'/>".repeat(20_001);
    expect(() => assertSvgPathCount(`<svg>${paths}</svg>`)).toThrow(
      "The trace has 20001 paths, above the 20000 path limit."
    );
    expect(assertSvgPathCount(`<svg>${"<path d='M0'/>".repeat(20_000)}</svg>`)).toBe(20_000);

    const terminate = vi.fn();
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {}
      terminate = terminate;
    }
    vi.stubGlobal("Worker", PendingWorker);
    const controller = new AbortController();
    const result = tracePixelsInWorker(new Uint8ClampedArray(4), 1, 1, options, preprocessing, controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow(TRACE_CANCELLED);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("keeps a connected web catalog available for chat", () => {
    expect(shouldLoadModelCatalog({ host: "web", workspaceTrusted: false, connectionStatus: "connected" })).toBe(true);
    expect(shouldLoadModelCatalog({ host: "web", workspaceTrusted: true, connectionStatus: "disconnected" })).toBe(
      false
    );
    expect(shouldLoadModelCatalog({ host: "vscode", workspaceTrusted: false, connectionStatus: "connected" })).toBe(
      false
    );
    expect(shouldLoadModelCatalog({ host: "standalone", workspaceTrusted: true, connectionStatus: "connected" })).toBe(
      true
    );
  });

  it("keeps the module-worker probe on this origin", () => {
    const source = readFileSync(new URL("../src/web/browserSupport.ts", import.meta.url), "utf8");
    const probe = readFileSync(new URL("../public/module-worker-probe.js", import.meta.url), "utf8");
    expect(source).not.toContain("createObjectURL");
    // The probe is loaded from the app base ("/" or "/app/"), always on this origin.
    expect(source).toMatch(/import.meta.env.BASE_URL}module-worker-probe.js/);
    expect(probe).toContain("export");
  });
});
