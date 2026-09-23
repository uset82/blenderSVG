import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

function studioApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "studio-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/vectorize-sample" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body || "{}");
              const engine = data.engine || "vtracer";
              const prompt = data.prompt || "Cute robot mascot avatar head with glowing eyes";

              if (engine === "zenmux") {
                const apiKey = data.apiKey || env.ZENMUX_API_KEY || process.env.ZENMUX_API_KEY || "sk-ai-v1-21579e5c5fa3702c90f74df6451a4c5b7af75c465758161cfd541605150778c3";
                const { generateSvgWithZenMux } = await import("@codex-avatar-studio/asset-pipeline");
                const svg = await generateSvgWithZenMux({
                  prompt,
                  apiKey,
                  model: data.model || "z-ai/glm-4.6v-flash-free"
                });
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, svg, engine: "zenmux" }));
                return;
              }

              if (engine === "openrouter") {
                const apiKey = data.apiKey || env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "";
                const { generateSvgWithOpenRouter } = await import("@codex-avatar-studio/asset-pipeline");
                const svg = await generateSvgWithOpenRouter({
                  prompt,
                  apiKey: apiKey || undefined,
                  model: data.model || "google/gemini-2.0-flash-exp:free"
                });
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, svg, engine: "openrouter" }));
                return;
              }

              // Default / VTracer
              const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 168"><path id="bg" fill="#171b22" d="M0 168V0h168v168z"/><circle id="face" cx="84" cy="74" r="36" fill="#ebbe9c"/><path id="body" d="M52 106 L116 106 L124 150 L44 150 Z" fill="#da3633"/><ellipse id="hat" cx="84" cy="38" rx="28" ry="10" fill="#0d1117"/><circle cx="73" cy="72" r="4" fill="#0d1117"/><circle cx="95" cy="72" r="4" fill="#0d1117"/><path id="accent" d="M64 106 L84 126 L104 106 Z" fill="#388bfd"/></svg>`;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, svg: sampleSvg, engine: "vtracer" }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../../", "");
  return {
    plugins: [react(), studioApiPlugin(env)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port: 5174,
      host: true
    }
  };
});
