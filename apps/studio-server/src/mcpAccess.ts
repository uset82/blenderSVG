export type McpPermission = "read" | "propose" | "apply";

export interface McpClient {
  id: string;
  name: string;
  token: string;
  permission: McpPermission;
  revoked: boolean;
  lastSeen: string | null;
}

const WRITE_TOOLS = new Set([
  "create_design_frame",
  "create_shapes",
  "update_shapes",
  "delete_shapes",
  "insert_svg",
  "vectorize_image"
]);

export type McpAuthorization = "ok" | "missing" | "revoked" | "read-only";

export function authorizeMcpCall(client: McpClient | undefined, tool: string): McpAuthorization {
  if (!client) return "missing";
  if (client.revoked) return "revoked";
  if (client.permission === "read" && WRITE_TOOLS.has(tool)) return "read-only";
  return "ok";
}

export function summarizeCanvasSnapshot(snapshot: string): { shapeCount: number; frames: string[] } {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; type?: string; props?: { name?: string } }> };
  };
  const shapes = Object.values(parsed.document?.store ?? {}).filter((record) => record.typeName === "shape");
  return {
    shapeCount: shapes.length,
    frames: shapes.filter((shape) => shape.type === "frame").map((shape) => shape.props?.name ?? "")
  };
}

export function readProjectStyle(snapshot: string): Record<string, unknown> {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; meta?: Record<string, unknown> }> };
  };
  const document = Object.values(parsed.document?.store ?? {}).find((record) => record.typeName === "document");
  return document?.meta ?? {};
}

export function readSavedSelection(snapshot: string): string[] {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; selectedShapeIds?: unknown }> };
  };
  const pageState = Object.values(parsed.document?.store ?? {}).find(
    (record) => record.typeName === "instance_page_state"
  );
  return Array.isArray(pageState?.selectedShapeIds) ? pageState.selectedShapeIds.map(String) : [];
}

export function readDesignFrameHtml(snapshot: string, frameId: string): string | null {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; type?: string; props?: { html?: string } }> };
  };
  const match = Object.entries(parsed.document?.store ?? {}).find(
    ([id, record]) => record.typeName === "shape" && record.type === "design-frame" && (!frameId || id === frameId)
  );
  const html = match?.[1].props?.html;
  return typeof html === "string" ? html : null;
}

export function exportSavedFrame(
  snapshot: string,
  frameId: string,
  format: string
): { format: string; body: string } | { error: string } {
  const parsed = JSON.parse(snapshot) as {
    document?: {
      store?: Record<
        string,
        { typeName?: string; type?: string; props?: { w?: number; h?: number; html?: string; name?: string } }
      >;
    };
  };
  const match = Object.entries(parsed.document?.store ?? {}).find(
    ([id, record]) => record.typeName === "shape" && id === frameId
  );
  if (!match) return { error: "Frame not found." };
  const props = match[1].props ?? {};
  if (format === "html") {
    return typeof props.html === "string" ? { format, body: props.html } : { error: "This shape has no HTML." };
  }
  if (format === "svg") {
    const w = typeof props.w === "number" ? props.w : 100;
    const h = typeof props.h === "number" ? props.h : 100;
    const name = props.name ?? frameId;
    return {
      format,
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><title>${name}</title><rect width="${w}" height="${h}" fill="none"/></svg>`
    };
  }
  return { error: "PNG export needs the live editor." };
}

const BOUNDS_PREVIEW_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function savedFrameBoundsPreview(
  snapshot: string,
  frameId: string
): { kind: "bounds-preview"; width: number; height: number; pngBase64: string; note: string } | { error: string } {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; props?: { w?: number; h?: number } }> };
  };
  const record = parsed.document?.store?.[frameId];
  if (!record || record.typeName !== "shape") return { error: "Frame not found." };
  return {
    kind: "bounds-preview",
    width: record.props?.w ?? 0,
    height: record.props?.h ?? 0,
    pngBase64: BOUNDS_PREVIEW_PNG,
    note: "Not a canvas raster. The live editor is required for a screenshot."
  };
}

export function updateSavedShape(snapshot: string, shapeId: string, patch: { name?: string }): string | null {
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName?: string; props?: { name?: string } }> };
  };
  const record = parsed.document?.store?.[shapeId];
  if (!record || record.typeName !== "shape") return null;
  if (typeof patch.name === "string") {
    record.props = { ...record.props, name: patch.name };
  }
  return JSON.stringify(parsed);
}

export function deleteSavedShape(snapshot: string, shapeId: string): string | null {
  const parsed = JSON.parse(snapshot) as { document?: { store?: Record<string, { typeName?: string }> } };
  const record = parsed.document?.store?.[shapeId];
  if (!record || record.typeName !== "shape") return null;
  delete parsed.document?.store?.[shapeId];
  return JSON.stringify(parsed);
}

export function createSavedShapes(
  snapshot: string,
  shapes: readonly { id: string; name: string; w: number; h: number }[]
): string {
  const parsed = JSON.parse(snapshot) as {
    document?: {
      store?: Record<string, { typeName: string; type: string; props: { name: string; w: number; h: number } }>;
    };
  };
  if (!parsed.document) return snapshot;
  parsed.document.store ??= {};
  for (const shape of shapes) {
    parsed.document.store[shape.id] = {
      typeName: "shape",
      type: "geo",
      props: { name: shape.name, w: shape.w, h: shape.h }
    };
  }
  return JSON.stringify(parsed);
}

export function insertSavedSvg(snapshot: string, shapeId: string, svg: string): string | { error: string } {
  if (!svg.includes("<svg")) return { error: "svg must be an SVG document." };
  const clean = svg.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  if (clean.toLowerCase().includes("<script")) return { error: "SVG was not sanitized." };
  const parsed = JSON.parse(snapshot) as {
    document?: { store?: Record<string, { typeName: string; type: string; props: { svg: string } }> };
  };
  if (!parsed.document) return { error: "Project not found." };
  parsed.document.store ??= {};
  parsed.document.store[shapeId] = { typeName: "shape", type: "vector-studio", props: { svg: clean } };
  return JSON.stringify(parsed);
}

export function createSavedDesignFrame(snapshot: string, shapeId: string, name: string, html: string): string {
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const parsed = JSON.parse(snapshot) as {
    document?: {
      store?: Record<
        string,
        { typeName: string; type: string; props: { name: string; html: string; w: number; h: number } }
      >;
    };
  };
  if (!parsed.document) return snapshot;
  parsed.document.store ??= {};
  parsed.document.store[shapeId] = {
    typeName: "shape",
    type: "design-frame",
    props: { name, html: clean, w: 800, h: 600 }
  };
  return JSON.stringify(parsed);
}

export function touchMcpClient(client: McpClient, seenAt: string): McpClient {
  client.lastSeen = seenAt;
  return client;
}

export function publicMcpClient(client: McpClient): {
  id: string;
  name: string;
  permission: McpPermission;
  revoked: boolean;
  lastSeen: string | null;
} {
  return {
    id: client.id,
    name: client.name,
    permission: client.permission,
    revoked: client.revoked,
    lastSeen: client.lastSeen
  };
}

export function createMcpClient(
  clients: McpClient[],
  name: string,
  permission: McpPermission,
  token: string
): McpClient {
  const client: McpClient = {
    id: `mcp-${clients.length + 1}`,
    name: name.trim().slice(0, 80) || "IDE",
    token,
    permission,
    revoked: false,
    lastSeen: null
  };
  clients.push(client);
  return client;
}

const TOOL_CHECKS: Record<string, (args: Record<string, unknown>) => string | null> = {
  get_canvas_state: () => null,
  get_selection: () => null,
  get_styles: () => null,
  screenshot_frame: (args) => (typeof args.frameId === "string" && args.frameId.trim() ? null : "frameId is required."),
  create_design_frame: (args) =>
    typeof args.name === "string" && typeof args.html === "string" ? null : "name and html are required.",
  create_shapes: (args) =>
    Array.isArray(args.shapes) && args.shapes.length > 0 ? null : "shapes must be a non-empty array.",
  update_shapes: (args) => (Array.isArray(args.updates) ? null : "updates must be an array."),
  delete_shapes: (args) => (Array.isArray(args.shapeIds) ? null : "shapeIds must be an array."),
  insert_svg: (args) =>
    typeof args.svg === "string" && args.svg.includes("<svg") ? null : "svg must be an SVG document.",
  vectorize_image: (args) =>
    typeof args.imagePath === "string" && args.imagePath.trim() ? null : "imagePath is required.",
  export_frame: (args) =>
    args.format === "png" || args.format === "svg" || args.format === "html"
      ? null
      : "format must be png, svg, or html."
};

export function validateMcpTool(tool: string, args: unknown): string | null {
  const check = TOOL_CHECKS[tool];
  if (!check) return "Unknown tool.";
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args)))
    return "Arguments must be an object.";
  return check((args ?? {}) as Record<string, unknown>);
}

export interface CanvasEdit {
  source: "ui" | "mcp";
  baseRevision: number;
  shapeId: string;
}

export function applyConcurrentEdits(
  revision: number,
  edits: readonly CanvasEdit[]
): { revision: number; applied: CanvasEdit[]; conflicts: CanvasEdit[] } {
  let current = revision;
  const applied: CanvasEdit[] = [];
  const conflicts: CanvasEdit[] = [];
  for (const edit of edits) {
    if (edit.baseRevision !== current) conflicts.push(edit);
    else {
      applied.push(edit);
      current += 1;
    }
  }
  return { revision: current, applied, conflicts };
}
