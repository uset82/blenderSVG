// One-off diagnostic: why does the Intelligence filter read 0 on kurva.agency/app?
//
// The app loads its catalog from GET /api/v1/models/user (account-scoped) when a
// key is present. The public GET /api/v1/models carries
// benchmarks.artificial_analysis.intelligence_index today, but the account
// endpoint may not. This script fetches BOTH with your key and reports which one
// actually carries the field, plus what /api/v1/benchmarks returns.
//
// Usage:
//   OPENROUTER_API_KEY=sk-or-v1-... node scripts/probe-intelligence-source.mjs
//
// Nothing is written to disk and the key is never printed.

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("Set OPENROUTER_API_KEY first, e.g.");
  console.error("  OPENROUTER_API_KEY=sk-or-v1-... node scripts/probe-intelligence-source.mjs");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };

function countIntelligence(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const withBenchmarks = rows.filter((m) => m?.benchmarks && Object.keys(m.benchmarks).length > 0);
  const withAA = rows.filter((m) => m?.benchmarks?.artificial_analysis != null);
  const withIndex = rows.filter((m) => typeof m?.benchmarks?.artificial_analysis?.intelligence_index === "number");
  const withDesignArena = rows.filter((m) => Array.isArray(m?.benchmarks?.design_arena));
  return {
    rows: rows.length,
    withBenchmarks: withBenchmarks.length,
    withArtificialAnalysis: withAA.length,
    withIntelligenceIndex: withIndex.length,
    withDesignArena: withDesignArena.length,
    sample: withIndex[0]
      ? {
          id: withIndex[0].id,
          intelligence_index: withIndex[0].benchmarks.artificial_analysis.intelligence_index
        }
      : null
  };
}

async function probe(label, url, extraHeaders = headers) {
  process.stdout.write(`\n=== ${label} ===\n${url}\n`);
  try {
    const response = await fetch(url, { headers: extraHeaders });
    console.log(`status: ${response.status}`);
    if (!response.ok) {
      console.log(`body: ${(await response.text()).slice(0, 200)}`);
      return null;
    }
    const payload = await response.json();
    const stats = countIntelligence(payload);
    console.log(JSON.stringify(stats, null, 2));
    return stats;
  } catch (error) {
    console.log(`error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const account = await probe(
  "GET /api/v1/models/user  (what the app actually calls)",
  "https://openrouter.ai/api/v1/models/user?output_modalities=all"
);

const publicList = await probe(
  "GET /api/v1/models  (public list)",
  "https://openrouter.ai/api/v1/models?output_modalities=all"
);

const benchmarks = await probe(
  "GET /api/v1/benchmarks?source=artificial-analysis  (dedicated scores)",
  "https://openrouter.ai/api/v1/benchmarks?source=artificial-analysis"
);

console.log("\n=== verdict ===\n");
if (account && account.withIntelligenceIndex > 0) {
  console.log("The account endpoint DOES carry intelligence_index.");
  console.log("=> The 0 on /app/ is a client/transport problem, not upstream.");
} else if (publicList && publicList.withIntelligenceIndex > 0) {
  console.log("Account endpoint is MISSING intelligence_index; the public list HAS it.");
  console.log(`  account: ${account?.withIntelligenceIndex ?? "n/a"} scored rows`);
  console.log(`  public : ${publicList.withIntelligenceIndex} scored rows`);
  console.log("=> Fix: keep /models/user for account scope, but source benchmark");
  console.log("   scores from /api/v1/models (or /api/v1/benchmarks) and merge by id.");
} else {
  console.log("Neither endpoint carries intelligence_index right now.");
  console.log("=> Upstream has stopped publishing it on these paths; the chip cannot");
  console.log("   be populated from the catalog alone anymore.");
}

if (benchmarks) {
  const rows = Array.isArray(benchmarks.data) ? benchmarks.data : [];
  const aa = rows.filter((r) => r?.source === "artificial-analysis");
  console.log(`\n/api/v1/benchmarks returned ${rows.length} rows (${aa.length} artificial-analysis).`);
  if (aa[0]) console.log(`sample: ${aa[0].model_permaslug} -> ${aa[0].intelligence_index}`);
}
