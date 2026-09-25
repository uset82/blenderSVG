#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeBlenderSvgCompatibility, previewImageToSvg } from "@codex-avatar-studio/asset-pipeline";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVER_INSTRUCTIONS } from "./instructions.js";
import { STUDIO_MCP_TOOLS } from "./studioTools.js";

const server = new Server(
  {
    name: "blender-svg-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    },
    instructions: MCP_SERVER_INSTRUCTIONS
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "studio_status",
        description: "Check the status of local blenderSVG image tracing and Blender.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "vectorize_image",
        description: "Trace a local PNG or JPEG image into an SVG using local VTracer or ImageTracer.",
        inputSchema: {
          type: "object",
          properties: {
            imagePath: {
              type: "string",
              description: "Path to the input image file."
            },
            engine: {
              type: "string",
              enum: ["vtracer", "imagetracer"],
              default: "vtracer",
              description: "Local image tracing engine."
            },
            outputPath: {
              type: "string",
              description: "Optional destination path for the resulting SVG."
            }
          },
          additionalProperties: false,
          required: ["imagePath"]
        }
      },
      {
        name: "blender_capability_check",
        description:
          "Perform loss-aware diagnostic analysis on an SVG file to determine its compatibility with Blender Curves (3D extrusion) vs Blender Grease Pencil (2D illustration and animation).",
        inputSchema: {
          type: "object",
          properties: {
            svgPath: {
              type: "string",
              description: "Path to the SVG file to analyze."
            }
          },
          additionalProperties: false,
          required: ["svgPath"]
        }
      },
      ...STUDIO_MCP_TOOLS.filter((tool) => tool.name !== "vectorize_image").map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "studio_status") {
      const configured = process.env.BLENDER_PATH?.trim() ?? "";
      const detected = configured.length > 0 && existsSync(configured);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                studio: "blenderSVG Agentic Infinite Canvas Studio",
                status: "active",
                engines: {
                  localVTracer: "Ready (@visioncortex/vtracer WASM Bézier splines, 100% free / local)",
                  localImageTracer: "Ready (ImageTracer.js, local)",
                  blender: {
                    detected,
                    source: configured ? "BLENDER_PATH" : "unset"
                  }
                }
              },
              null,
              2
            )
          }
        ]
      };
    }

    if (name === "vectorize_image") {
      const imagePath = String(args?.imagePath ?? "");
      const engine = args?.engine ?? "vtracer";
      if (engine !== "vtracer" && engine !== "imagetracer") {
        throw new Error("Only local vtracer and imagetracer engines are available.");
      }
      const outputPath = args?.outputPath ? String(args.outputPath) : undefined;

      const resolvedImagePath = path.resolve(imagePath);
      if (!existsSync(resolvedImagePath)) {
        throw new Error(`Input image file not found: ${imagePath}`);
      }

      const preview = await previewImageToSvg({
        inputPath: resolvedImagePath,
        workspaceRoot: process.cwd(),
        engine
      });

      const resultSvg = preview.optimizedSvg;

      if (outputPath) {
        mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        writeFileSync(path.resolve(outputPath), resultSvg, "utf8");
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully vectorized image using local engine '${engine}'!\nOriginal: ${preview.inputPath}\n${outputPath ? `Output saved: ${outputPath}` : "Preview only; no file was saved."}\nSVG preview (first 300 chars):\n${resultSvg.slice(0, 300)}...`
          }
        ]
      };
    }

    if (name === "avatar_set_state" || name === "blender_export_lineart") {
      throw new Error(`${name} was removed. It did not change the canvas.`);
    }

    if (STUDIO_MCP_TOOLS.some((tool) => tool.name === name) && name !== "vectorize_image") {
      throw new Error("The Studio project bridge is not connected, so this tool did not change the canvas.");
    }

    if (name === "blender_capability_check") {
      const svgPath = String(args?.svgPath ?? "");
      const resolved = path.resolve(svgPath);
      if (!existsSync(resolved)) {
        throw new Error(`SVG file not found: ${svgPath}`);
      }

      const svgContent = readFileSync(resolved, "utf8");
      const report = analyzeBlenderSvgCompatibility(svgContent);

      return {
        content: [
          {
            type: "text",
            text:
              `Blender SVG Compatibility Diagnostic for '${path.basename(svgPath)}':\n\n` +
              `• Recommended Adapter: ${report.recommendedAdapter.toUpperCase()}\n` +
              `• Curve Adapter Score: ${report.curveCompatibility.score}/100 (${report.curveCompatibility.summary})\n` +
              `• Grease Pencil Score: ${report.greasePencilCompatibility.score}/100 (${report.greasePencilCompatibility.summary})\n` +
              `• Path Count: ${report.totalPaths}, Groups: ${report.totalGroups}\n` +
              `• Fills: ${report.solidFills} solid, ${report.gradientFills} gradients\n` +
              `• Strokes: ${report.strokes}\n\n` +
              (report.warnings.length > 0
                ? `Warnings:\n${report.warnings.map((w) => `⚠️ ${w}`).join("\n")}`
                : "✓ 100% compatible without loss.")
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${errorMessage}`
        }
      ]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("blenderSVG MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting blenderSVG MCP Server:", err);
  process.exit(1);
});
