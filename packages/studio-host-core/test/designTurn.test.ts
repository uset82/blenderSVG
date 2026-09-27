import { createHostToStudioMessage, type StudioToHostMessage } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it, vi } from "vitest";
import { OpenRouterChatController } from "../src/openRouterChat.js";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "../src/openRouterConnection.js";
import { catalogResponse, type ScriptedRound, sseRound, toolModel } from "./fixtures/sse.js";

type ChatRequest = Extract<StudioToHostMessage, { type: "studio:chatRequest" }>;
type Emitted = { type: string; [key: string]: unknown };
type Body = { messages: Array<Record<string, unknown>>; tool_choice?: string; max_completion_tokens?: number };

const secrets: SecretStore = {
  get: async (name) => (name === OPENROUTER_SECRET_KEY ? "sk-or-v1-test-regular-user-key" : undefined),
  store: async () => undefined,
  delete: async () => undefined
};

const PAGE = `<!doctype html><html><head><style>${".hero{display:grid;gap:24px}".repeat(4_200)}</style></head><body><main class="hero"><h1>Clay &amp; Kiln</h1></main></body></html>`;

function request(mode: ChatRequest["mode"], requestId = "design-turn"): ChatRequest {
  return {
    protocolVersion: 1,
    type: "studio:chatRequest",
    requestId,
    modelId: "example/designer",
    history: [],
    userMessage: "Design a landing page for a neighborhood ceramics studio",
    ...(mode ? { mode } : {})
  };
}

/**
 * A controller wired to a scripted OpenRouter and a fake canvas. Each toolExecute is answered by
 * `canvas`, and approvals are granted when `approve` is set.
 */
function harness(
  rounds: Array<ScriptedRound | Response>,
  options: {
    model?: Record<string, unknown>;
    approve?: boolean;
    canvas?: (name: string, args: string) => { ok: boolean; content: string };
  } = {}
) {
  const queue = [...rounds];
  const bodies: Body[] = [];
  const messages: Emitted[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (!String(url).includes("/chat/completions")) return catalogResponse([options.model ?? toolModel()]);
    bodies.push(JSON.parse(String(init?.body)) as Body);
    const next = queue.shift() ?? { text: "Done." };
    return next instanceof Response ? next : new Response(sseRound(next), { status: 200 });
  });
  const gateway: OpenRouterChatController = new OpenRouterChatController(
    secrets,
    (message) => {
      // Validate every message against the protocol, as the web and desktop transports do.
      createHostToStudioMessage(message);
      const emitted = message as unknown as Emitted;
      messages.push(emitted);
      const requestId = String(emitted.requestId);
      const callId = String(emitted.callId);
      if (emitted.type === "studio:toolProposed" && emitted.requiresApproval && options.approve) {
        setTimeout(() => gateway.resolveToolPermission(requestId, callId, true), 0);
      }
      if (emitted.type === "studio:toolExecute") {
        const result = options.canvas?.(String(emitted.name), String(emitted.arguments)) ?? {
          ok: true,
          content: `Applied ${String(emitted.name)}.`
        };
        setTimeout(() => gateway.resolveToolExecutionResult(requestId, callId, result), 0);
      }
    },
    fetcher
  );
  return { gateway, messages, bodies };
}

const ofType = (messages: Emitted[], type: string) => messages.filter((message) => message.type === type);
const toolMessages = (body: Body | undefined) => (body?.messages ?? []).filter((message) => message.role === "tool");

describe("design turn harness", () => {
  it("creates a large design, feeds the result back, and completes with the model's summary", async () => {
    const args = JSON.stringify({ name: "Clay & Kiln — Desktop", html: PAGE, width: 1440 });
    expect(args.length).toBeGreaterThan(100_000);
    const { gateway, messages, bodies } = harness([
      {
        text: "Designing the page.",
        calls: [{ id: "call-create", name: "create_design_frame", arguments: args }],
        chunk: 6_000
      },
      { text: "I designed a warm landing page with a hero, classes and a visit section." }
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));

    const proposed = ofType(messages, "studio:toolProposed")[0];
    expect(proposed?.requiresApproval).toBe(false);
    const executed = ofType(messages, "studio:toolExecute")[0];
    expect(JSON.parse(String(executed?.arguments)).html).toBe(PAGE);
    expect(ofType(messages, "studio:toolProgress").length).toBeGreaterThan(5);
    expect(bodies[0]?.max_completion_tokens).toBe(32_000);
    expect(bodies[0]?.tool_choice).toBe("auto");
    const assistant = bodies[1]?.messages.find((message) => message.role === "assistant");
    expect(assistant?.content).toBe("Designing the page.");
    expect(toolMessages(bodies[1])).toEqual([
      { role: "tool", tool_call_id: "call-create", content: "Applied create_design_frame." }
    ]);
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
    expect(gateway.turn("design-turn")?.state).toBe("done");
  });

  it("completes a turn whose last round has tool calls and no text", async () => {
    const create = JSON.stringify({ name: "Landing", html: "<main><h1>Hi</h1></main>" });
    const { gateway, messages } = harness([
      { calls: [{ id: "call-1", name: "create_design_frame", arguments: create }] },
      {}
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(ofType(messages, "studio:chatError")).toEqual([]);
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("returns invalid arguments to the model, which then corrects them", async () => {
    const { gateway, messages, bodies } = harness([
      { calls: [{ id: "call-bad", name: "create_design_frame", arguments: JSON.stringify({ name: "Landing" }) }] },
      {
        calls: [
          {
            id: "call-good",
            name: "create_design_frame",
            arguments: JSON.stringify({ name: "Landing", html: "<main>Hi</main>" })
          }
        ]
      },
      { text: "Fixed and created." }
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    const executed = ofType(messages, "studio:toolExecute").map((message) => message.callId);
    expect(executed).toEqual(["call-good"]);
    const feedback = String(toolMessages(bodies[1])[0]?.content);
    expect(feedback).toContain("InputValidationError");
    expect(feedback).toContain("`html` is missing");
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("answers an unknown tool, a tool from another mode, and calls over the round limit", async () => {
    const reads = Array.from({ length: 7 }, (_, index) => ({
      id: `call-read-${index}`,
      name: "get_canvas_summary",
      arguments: "{}"
    }));
    const { gateway, messages, bodies } = harness([
      {
        calls: [
          { id: "call-unknown", name: "draw_unicorn", arguments: "{}" },
          { id: "call-shapes", name: "create_shapes", arguments: '{"frameId":"shape:a","shapes":[]}' },
          ...reads
        ]
      },
      { text: "Done." }
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    const answers = toolMessages(bodies[1]);
    expect(answers.map((message) => message.tool_call_id)).toEqual([
      "call-unknown",
      "call-shapes",
      ...reads.map((call) => call.id)
    ]);
    expect(String(answers[0]?.content)).toContain('no tool named "draw_unicorn"');
    expect(String(answers[1]?.content)).toContain("not available in auto mode");
    expect(String(answers[8]?.content)).toContain("Only 8 tool calls run per round");
    expect(ofType(messages, "studio:toolExecute")).toHaveLength(6);
  });

  it("tells the model when its arguments were cut off at the output limit", async () => {
    const { gateway, messages, bodies } = harness([
      {
        calls: [{ id: "call-cut", name: "create_design_frame", arguments: '{"name":"Landing","html":"<main><section' }],
        finishReason: "length"
      },
      { text: "I will split the page into smaller calls." }
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(ofType(messages, "studio:toolExecute")).toHaveLength(0);
    expect(String(toolMessages(bodies[1])[0]?.content)).toMatch(/cut off.*patch_design_frame/);
  });

  it("retries a 402 once with the output budget the account can afford", async () => {
    const credits = new Response(
      JSON.stringify({
        error: {
          code: 402,
          message: "This request requires more credits. You requested up to 32000 tokens, but can only afford 9000."
        }
      }),
      { status: 402 }
    );
    const { gateway, messages, bodies } = harness([credits, { text: "Hello." }]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(bodies.map((body) => body.max_completion_tokens)).toEqual([32_000, 8_744]);
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("reads without approval in Review (build) mode, but asks before changing the canvas", async () => {
    const { gateway, messages } = harness(
      [
        {
          calls: [
            { id: "call-read", name: "get_canvas_summary", arguments: "{}" },
            {
              id: "call-write",
              name: "create_design_frame",
              arguments: JSON.stringify({ name: "Landing", html: "<p>x</p>" })
            }
          ]
        },
        { text: "Done." }
      ],
      { approve: true }
    );
    await gateway.refreshModels();
    await gateway.send(request("build"));
    const proposals = Object.fromEntries(
      ofType(messages, "studio:toolProposed").map((message) => [message.callId, message.requiresApproval])
    );
    expect(proposals).toEqual({ "call-read": false, "call-write": true });
    expect(ofType(messages, "studio:toolExecute").map((message) => message.callId)).toEqual([
      "call-read",
      "call-write"
    ]);
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("runs reads together and changes one at a time, in the model's order", async () => {
    const { gateway, messages } = harness([
      {
        calls: [
          { id: "read-1", name: "get_canvas_summary", arguments: "{}" },
          { id: "read-2", name: "get_design_frame", arguments: '{"frameId":"shape:a"}' },
          {
            id: "patch",
            name: "patch_design_frame",
            arguments: JSON.stringify({ frameId: "shape:a", edits: [{ find: "a", replace: "b" }] })
          },
          { id: "read-3", name: "get_canvas_summary", arguments: "{}" }
        ]
      },
      { text: "Done." }
    ]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    const order = messages
      .filter((message) => message.type === "studio:toolExecute" || message.type === "studio:toolResult")
      .map((message) => `${message.type === "studio:toolExecute" ? "run" : "done"}:${String(message.callId)}`);
    expect(order).toEqual([
      "run:read-1",
      "run:read-2",
      "done:read-1",
      "done:read-2",
      "run:patch",
      "done:patch",
      "run:read-3",
      "done:read-3"
    ]);
  });

  it("stops offering tools at the round limit and asks the model for a summary", async () => {
    const rounds: ScriptedRound[] = Array.from({ length: 8 }, (_, index) => ({
      calls: [{ id: `call-${index}`, name: "get_canvas_summary", arguments: "{}" }]
    }));
    const { gateway, messages, bodies } = harness([...rounds, { text: "Here is what I changed." }]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(bodies).toHaveLength(9);
    expect(bodies[7]?.tool_choice).toBe("auto");
    expect(bodies[8]?.tool_choice).toBe("none");
    expect(ofType(messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("closes tools after three rounds in which every call failed", async () => {
    const create = JSON.stringify({ name: "Landing", html: "<p>x</p>" });
    const rounds: ScriptedRound[] = Array.from({ length: 3 }, (_, index) => ({
      calls: [{ id: `call-${index}`, name: "create_design_frame", arguments: create }]
    }));
    const { gateway, bodies } = harness([...rounds, { text: "The canvas kept failing." }], {
      canvas: () => ({ ok: false, content: "The canvas could not apply this." })
    });
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(bodies.map((body) => body.tool_choice)).toEqual(["auto", "auto", "auto", "none"]);
  });

  it("sends the design prompt with the skill and canvas, and no tools to a model without them", async () => {
    const designContext = {
      pageName: "Scratchpad",
      frames: [
        { id: "shape:empty", name: "Frame", kind: "frame" as const, x: 0, y: 0, width: 1440, height: 1024, empty: true }
      ],
      selectedIds: []
    };
    const withTools = harness([{ text: "Done." }]);
    await withTools.gateway.refreshModels();
    await withTools.gateway.send({ ...request("auto"), skill: "landing", designContext });
    const system = String(withTools.bodies[0]?.messages[0]?.content);
    expect(withTools.bodies[0]?.messages[0]?.role).toBe("system");
    expect(system).toContain("create_design_frame");
    expect(system).toContain("Design brief: Landing page");
    expect(system).toContain("(shape:empty), 1440×1024 at 0, 0, empty");
    expect(system).not.toContain("cannot change the canvas");

    const textOnly = harness([{ text: '```svg\n<svg viewBox="0 0 10 10"></svg>\n```' }], {
      model: toolModel({ supported_parameters: ["max_tokens"] })
    });
    await textOnly.gateway.refreshModels();
    await textOnly.gateway.send(request("auto", "design-turn-text"));
    const body = textOnly.bodies[0] as Body & { tools?: unknown };
    expect(body.tools).toBeUndefined();
    expect(String(body.messages[0]?.content)).toContain("kurva-frame");
    expect(ofType(textOnly.messages, "studio:chatComplete")).toHaveLength(1);
  });

  it("reports a model that stops at its output limit without any reply", async () => {
    const { gateway, messages } = harness([{ finishReason: "length" }]);
    await gateway.refreshModels();
    await gateway.send(request("auto"));
    expect(String(ofType(messages, "studio:chatError")[0]?.message)).toContain("output limit");
  });
});
