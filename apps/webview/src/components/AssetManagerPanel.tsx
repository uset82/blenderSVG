import { useMemo, useState } from "react";
import { resolveAvatarRuntime, validateAvatarManifest } from "@codex-avatar-studio/avatar-core";
import type { AvatarConfig, AvatarManifest, AvatarRuntime } from "../bridge/messages";
import { postToExtension } from "../bridge/vscodeApi";

type AssetManagerPanelProps = {
  config: AvatarConfig;
  manifest: AvatarManifest;
};

export function AssetManagerPanel({ config, manifest }: AssetManagerPanelProps) {
  const [validatedAt, setValidatedAt] = useState<number | null>(null);
  const validation = useMemo(() => validateAvatarManifest(manifest), [manifest]);
  const runtimeSupport = useMemo(() => getRuntimeSupport(manifest), [manifest]);
  const resolvedRuntime = resolveAvatarRuntime(config.runtime, manifest, runtimeSupport);
  const assetWarnings = useMemo(
    () => getAssetWarnings(manifest, config.runtime, validation.warnings),
    [config.runtime, manifest, validation.warnings]
  );
  const validationStatus = validation.valid
    ? `${assetWarnings.length} warning(s)`
    : `${validation.errors.length} error(s)`;

  return (
    <section className="asset-manager-panel" aria-label="Avatar asset manager">
      <div className="asset-manager-heading">
        <span className="section-label">Assets</span>
        <span className="runtime-badge">{resolvedRuntime}</span>
      </div>
      <dl className="asset-meta">
        <div>
          <dt>Manifest</dt>
          <dd>{manifest.name}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{manifest.id}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{config.runtime}</dd>
        </div>
      </dl>
      <ul className="asset-list" aria-label="Runtime assets">
        {getRuntimePriority(manifest).map((runtime) => (
          <li key={runtime}>
            <span>{runtime}</span>
            <code>{getRuntimeAssetPath(manifest, runtime) ?? "missing"}</code>
          </li>
        ))}
      </ul>
      <div className="asset-validation" data-valid={String(validation.valid)}>
        <span>{validatedAt ? `Validated: ${validationStatus}` : validationStatus}</span>
        {validation.errors.length > 0 || assetWarnings.length > 0 ? (
          <ul>
            {[...validation.errors, ...assetWarnings].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="asset-actions">
        <button type="button" onClick={() => postToExtension({ type: "command:openAssetsFolder" })}>
          Open
        </button>
        <button type="button" onClick={() => setValidatedAt(Date.now())}>
          Validate
        </button>
        <button type="button" onClick={() => postToExtension({ type: "command:vectorizeImage" })}>
          Vectorize
        </button>
        <button type="button" onClick={() => postToExtension({ type: "command:exportBlender" })}>
          Blender
        </button>
        <button type="button" onClick={() => postToExtension({ type: "command:reloadAvatar" })}>
          Reload
        </button>
      </div>
    </section>
  );
}

function getRuntimeSupport(manifest: AvatarManifest): Partial<Record<AvatarRuntime, boolean>> {
  return {
    svg: Boolean(getRuntimeAssetPath(manifest, "svg")),
    pixi: Boolean(getRuntimeAssetPath(manifest, "pixi")),
    inochi2d: Boolean(getRuntimeAssetPath(manifest, "inochi2d")),
    live2d: Boolean(getRuntimeAssetPath(manifest, "live2d")),
    vrm: Boolean(getRuntimeAssetPath(manifest, "vrm")),
    rive: Boolean(getRuntimeAssetPath(manifest, "rive")),
    webgl: Boolean(getRuntimeAssetPath(manifest, "webgl")),
    webgpu: Boolean(getRuntimeAssetPath(manifest, "webgpu"))
  };
}

function getRuntimeAssetPath(manifest: AvatarManifest, runtime: AvatarRuntime): string | undefined {
  return manifest.assets?.[runtime] ?? manifest.entrypoints[runtime];
}

function getRuntimePriority(manifest: AvatarManifest): AvatarRuntime[] {
  return manifest.runtimePriority ?? [manifest.preferredRuntime, manifest.fallbackRuntime];
}

function getAssetWarnings(
  manifest: AvatarManifest,
  selectedRuntime: AvatarRuntime,
  validationWarnings: string[]
): string[] {
  const warnings = new Set(validationWarnings);

  for (const runtime of getRuntimePriority(manifest)) {
    if (!getRuntimeAssetPath(manifest, runtime)) {
      warnings.add(`Runtime "${runtime}" is listed but has no asset path.`);
    }
  }

  if (selectedRuntime !== "svg" && !getRuntimeAssetPath(manifest, selectedRuntime)) {
    warnings.add(`Selected runtime "${selectedRuntime}" has no loaded asset and will fall back.`);
  }

  return [...warnings];
}
