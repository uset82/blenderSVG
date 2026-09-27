// Real-model check for the design agent (Phase 25.7). Runs the same agent loop the app uses
// (OpenRouterChatController on the ported ZCode turn machine) against real OpenRouter models, with an
// in-memory canvas that implements the design tools. Needs OPENROUTER_API_KEY and spends real credit.
//
//   OPENROUTER_API_KEY=… pnpm live:design                   # default pick + best free tool model
//   OPENROUTER_API_KEY=… pnpm live:design -- --models=a/b,c/d
//
// Writes each design as HTML/SVG, report.json (rounds, tool errors, tokens, cost, timings) and an
// index.html gallery to .codex-avatar/live-design/<timestamp>/ (ignored by Git).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Built workspace packages (run `pnpm build` first).
import { applyHtmlEdits, placeDesignFrame } from "../packages/studio-agent/dist/src/designFrames.js";
import { OpenRouterChatController } from "../packages/studio-host-core/dist/src/openRouterChat.js";
import { OPENROUTER_SECRET_KEY } from "../packages/studio-host-core/dist/src/openRouterConnection.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Set OPENROUTER_API_KEY to run the live design check. It spends real OpenRouter credit.");
  process.exit(2);
}
const requestedModels = process.argv
  .find((arg) => arg.startsWith("--models="))
  ?.slice("--models=".length)
  .split(",")
  .filter(Boolean);
const TURNS = [
  "Design a landing page for a neighborhood ceramics studio",
  "make the hero dark and add a mobile version",
  "dibuja un gato"
];
const outDir = path.join(ROOT, ".codex-avatar", "live-design", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(outDir, { recursive: true });

/** A canvas that keeps design frames and drawings in memory and answers the design tools. */
function memoryCanvas() {
  const shapes = [
    { id: "shape:starter", kind: "frame", name: "Landing page", x: 0, y: 0, w: 1440, h: 1024, empty: true }
  ];
  let next = 1;
  const newId = () => `shape:live${next++}`;
  const box = (shape) => ({ id: shape.id, x: shape.x, y: shape.y, w: shape.w, h: shape.h });
  const find = (id, kind) => {
    const shape = shapes.find((item) => item.id === id && (!kind || item.kind === kind));
    if (!shape)
      throw new Error(`${id} is not a ${kind ?? "shape"} on the canvas. Call get_canvas_summary to list them.`);
    return shape;
  };
  const estimateHeight = (html, width) => Math.max(900, Math.min(20_000, Math.round(html.length / (width / 8))));
  const tools = {
    get_canvas_summary: () => ({
      page: "Live check",
      designFrames: shapes
        .filter((s) => s.kind === "design")
        .map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, width: s.w, height: s.h, htmlChars: s.html.length })),
      emptyFrames: shapes
        .filter((s) => s.kind === "frame" && s.empty)
        .map((s) => ({ id: s.id, name: s.name, width: s.w, height: s.h })),
      drawings: shapes.filter((s) => s.kind === "svg").map((s) => ({ id: s.id, width: s.w, height: s.h }))
    }),
    get_design_frame: ({ frameId }) => {
      const frame = find(frameId, "design");
      return { id: frame.id, name: frame.name, width: frame.w, height: frame.h, html: frame.html };
    },
    create_design_frame: (args) => {
      const width = args.intoFrameId ? find(args.intoFrameId, "frame").w : (args.width ?? 1440);
      const height = args.height ?? estimateHeight(args.html, width);
      let spot;
      if (args.intoFrameId) {
        const empty = find(args.intoFrameId, "frame");
        shapes.splice(shapes.indexOf(empty), 1);
        spot = { x: empty.x, y: empty.y };
      } else {
        const existing = shapes.filter((s) => s.kind !== "svg").map(box);
        const anchor = args.placement?.relativeTo ? box(find(args.placement.relativeTo)) : undefined;
        spot = placeDesignFrame({
          width,
          height,
          existing,
          relativeTo: anchor,
          side: args.placement?.side,
          viewportCenter: { x: 0, y: 0 }
        });
      }
      const frame = { id: newId(), kind: "design", name: args.name, html: args.html, w: width, h: height, ...spot };
      shapes.push(frame);
      return { created: "design frame", id: frame.id, name: frame.name, x: frame.x, y: frame.y, width, height };
    },
    update_design_frame: (args) => {
      const frame = find(args.frameId, "design");
      if (args.html) frame.html = args.html;
      if (args.name) frame.name = args.name;
      if (args.width) frame.w = args.width;
      return { updated: frame.id, width: frame.w, height: frame.h };
    },
    patch_design_frame: ({ frameId, edits }) => {
      const frame = find(frameId, "design");
      const result = applyHtmlEdits(frame.html, edits);
      if (!result.ok) throw new Error(result.error);
      frame.html = result.html;
      return { patched: frame.id, applied: result.applied };
    },
    insert_svg: (args) => {
      const width = args.width ?? 512;
      const drawing = { id: newId(), kind: "svg", name: "Drawing", svg: args.svg, w: width, h: width, x: 0, y: -800 };
      shapes.push(drawing);
      return { inserted: "SVG", id: drawing.id, width, height: width };
    },
    delete_shapes: ({ shapeIds }) => {
      for (const id of shapeIds) shapes.splice(shapes.indexOf(find(id)), 1);
      return { deleted: shapeIds.length };
    }
  };
  return { shapes, tools };
}

function designContext(canvas) {
  return {
    pageName: "Live check",
    frames: canvas.shapes.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind === "design" ? "design-frame" : s.kind === "svg" ? "svg" : "frame",
      x: s.x,
      y: s.y,
      width: s.w,
      height: s.h,
      ...(s.empty ? { empty: true } : {})
    })),
    selectedIds: []
  };
}

async function runModel(controller, model) {
  const canvas = memoryCanvas();
  const history = [];
  const turns = [];
  for (const [index, userMessage] of TURNS.entries()) {
    const requestId = `live-${index}-${Date.now()}`;
    const started = Date.now();
    const events = { toolCalls: 0, toolErrors: 0, text: "", error: null, usage: null };
    const done = new Promise((resolve) => {
      controller.onMessage = async (message) => {
        if (message.requestId !== requestId) return;
        if (message.type === "studio:chatDelta") events.text += message.delta;
        if (message.type === "studio:toolExecute") {
          events.toolCalls += 1;
          let result;
          try {
            result = { ok: true, content: JSON.stringify(canvas.tools[message.name](JSON.parse(message.arguments))) };
          } catch (error) {
            result = { ok: false, content: error instanceof Error ? error.message : String(error) };
          }
          // Answer on the next task, like the app does, after the loop starts waiting for it.
          setTimeout(() => controller.chat.resolveToolExecutionResult(requestId, message.callId, result), 0);
        }
        // Counts every failed call: invalid arguments the loop returned, and canvas errors.
        if (message.type === "studio:toolResult" && !message.ok) events.toolErrors += 1;
        if (message.type === "studio:chatComplete") {
          events.usage = message.usage ?? null;
          resolve();
        }
        if (message.type === "studio:chatError") {
          events.error = `${message.code}: ${message.message}`;
          resolve();
        }
      };
    });
    await controller.chat.send({
      protocolVersion: 1,
      type: "studio:chatRequest",
      requestId,
      modelId: model.id,
      history,
      userMessage,
      mode: "auto",
      ...(index === 0 ? { skill: "landing" } : {}),
      designContext: designContext(canvas)
    });
    await done;
    history.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: events.text.slice(0, 11_000) || "(no text)" }
    );
    turns.push({
      prompt: userMessage,
      seconds: Math.round((Date.now() - started) / 1000),
      toolCalls: events.toolCalls,
      toolErrors: events.toolErrors,
      error: events.error,
      usage: events.usage,
      reply: events.text.slice(0, 600)
    });
  }
  return { canvas, turns };
}

const messages = { onMessage: () => undefined };
const secrets = {
  get: async (name) => (name === OPENROUTER_SECRET_KEY ? key : undefined),
  store: async () => {},
  delete: async () => {}
};
const chat = new OpenRouterChatController(secrets, (message) => void messages.onMessage(message), fetch, {
  title: "Kurva live design check"
});
const controller = {
  chat,
  set onMessage(handler) {
    messages.onMessage = handler;
  }
};
const catalog = await chat.refreshModels();
if (catalog.status !== "ready") {
  console.error(catalog.message);
  process.exit(1);
}
const designers = catalog.models
  .filter((m) => m.textChatEligible && m.supportedParameters.includes("tools"))
  .sort((a, b) => (b.designArenaElo ?? -1) - (a.designArenaElo ?? -1) || (b.codingIndex ?? -1) - (a.codingIndex ?? -1));
const free = designers.find((m) => Number(m.promptPrice) === 0 && Number(m.completionPrice) === 0);
const picks = requestedModels?.length
  ? requestedModels.map((id) => catalog.models.find((m) => m.id === id)).filter(Boolean)
  : [designers[0], free].filter(Boolean);
if (picks.length === 0) {
  console.error("No tool-capable model is available to this key.");
  process.exit(1);
}

const report = { date: new Date().toISOString(), models: [] };
const gallery = [];
for (const model of picks) {
  console.log(`Running ${model.id}…`);
  const { canvas, turns } = await runModel(controller, model);
  const dir = path.join(outDir, model.id.replace(/[^a-z0-9-]+/gi, "_"));
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const shape of canvas.shapes) {
    if (shape.kind === "design") {
      const file = `${shape.id.replace(":", "_")}.html`;
      writeFileSync(path.join(dir, file), shape.html);
      files.push({ file, name: shape.name, width: shape.w });
    } else if (shape.kind === "svg") {
      const file = `${shape.id.replace(":", "_")}.svg`;
      writeFileSync(path.join(dir, file), shape.svg);
      files.push({ file, name: "Drawing", width: shape.w });
    }
  }
  const cost = turns.reduce((sum, turn) => sum + (turn.usage?.cost ?? 0), 0);
  report.models.push({ id: model.id, cost, turns, files });
  gallery.push(
    `<h2>${model.id} · $${cost.toFixed(4)}</h2>` +
      files
        .map((f) =>
          f.file.endsWith(".svg")
            ? `<figure><img src="${path.basename(dir)}/${f.file}" width="320"><figcaption>${f.name}</figcaption></figure>`
            : `<figure><iframe src="${path.basename(dir)}/${f.file}" width="${Math.min(f.width, 1440) / 2}" height="700" sandbox></iframe><figcaption>${f.name} · ${f.width}px</figcaption></figure>`
        )
        .join("")
  );
}
writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  path.join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Kurva live design check</title><style>body{font-family:system-ui;margin:24px}figure{display:inline-block;margin:12px;vertical-align:top}iframe{border:1px solid #ddd;transform-origin:0 0}</style><h1>Kurva live design check</h1>${gallery.join("")}`
);
for (const model of report.models) {
  console.log(`${model.id}: $${model.cost.toFixed(4)}`);
  for (const turn of model.turns)
    console.log(
      `  ${turn.prompt.slice(0, 40)} · ${turn.seconds}s · ${turn.toolCalls} calls · ${turn.toolErrors} errors${turn.error ? ` · ${turn.error}` : ""}`
    );
}
console.log(`Report and gallery: ${path.relative(ROOT, outDir)}/index.html`);
