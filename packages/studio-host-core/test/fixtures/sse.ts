/** Builds OpenRouter-style SSE streams for agent tests. */

export interface ScriptedCall {
  id: string;
  name: string;
  /** The raw argument text, usually JSON.stringify of an object. It may be cut short on purpose. */
  arguments: string;
}

export interface ScriptedRound {
  text?: string;
  calls?: ScriptedCall[];
  finishReason?: string;
  /** Splits each call's arguments into chunks of this size, like a provider streaming a long page. */
  chunk?: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cost?: number };
}

export function sseRound(round: ScriptedRound): string {
  const events: unknown[] = [];
  if (round.text) {
    for (const piece of round.text.match(/.{1,40}/gs) ?? []) events.push({ choices: [{ delta: { content: piece } }] });
  }
  for (const [index, call] of (round.calls ?? []).entries()) {
    events.push({
      choices: [{ delta: { tool_calls: [{ index, id: call.id, function: { name: call.name, arguments: "" } }] } }]
    });
    const size = round.chunk ?? (call.arguments.length || 1);
    for (let offset = 0; offset < call.arguments.length; offset += size) {
      events.push({
        choices: [
          { delta: { tool_calls: [{ index, function: { arguments: call.arguments.slice(offset, offset + size) } }] } }
        ]
      });
    }
  }
  events.push({
    choices: [{ delta: {}, finish_reason: round.finishReason ?? (round.calls?.length ? "tool_calls" : "stop") }],
    ...(round.usage ? { usage: round.usage } : {})
  });
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

export function catalogResponse(models: Array<Record<string, unknown>>): Response {
  return new Response(JSON.stringify({ data: models }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

export function toolModel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "example/designer",
    name: "Designer",
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    description: "Fixture",
    context_length: 200_000,
    top_provider: { max_completion_tokens: 64_000 },
    pricing: { prompt: "0.000003", completion: "0.000015" },
    supported_parameters: ["max_completion_tokens", "tools", "tool_choice"],
    benchmarks: { artificial_analysis: {} },
    ...overrides
  };
}
