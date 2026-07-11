# Runtime Adapter Guide

Runtime adapters implement one shared contract so the extension can change renderers without changing IDE event handling. The permanent fallback is SVG. PixiJS is the required rich MVP adapter; Rive, Live2D, WebGL, WebGPU, Inochi2D, and VRM work are optional or deferred.

## Contract

The interface is defined in `packages/avatar-core/src/runtime.ts`:

```ts
export interface AvatarRuntimeAdapter {
  readonly kind: AvatarRuntimeKind;
  readonly capabilities: ReadonlySet<AvatarCapability>;
  initialize(container: HTMLElement, manifest: AvatarManifest): Promise<void>;
  setState(state: AvatarState): Promise<void> | void;
  trigger(trigger: AvatarTrigger): Promise<void> | void;
  setSpeechLevel(level: number): void;
  setVisible(visible: boolean): void;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): Promise<void> | void;
}
```

`initialize` owns renderer setup and local asset loading. It must reject on unsupported hardware or invalid assets, and it must leave no live canvas after `dispose`. `setVisible(false)` must pause continuous work. `resize` must clamp dimensions and device pixel ratio. `setSpeechLevel` accepts a normalized 0–1 signal. Adapter methods should be safe before initialization and after disposal.

## Minimal adapter skeleton

```ts
import type {
  AvatarCapability,
  AvatarManifest,
  AvatarRuntimeAdapter,
  AvatarState,
  AvatarTrigger
} from "@codex-avatar-studio/avatar-core";

export class ExampleAvatarRuntime implements AvatarRuntimeAdapter {
  readonly kind = "svg" as const;
  readonly capabilities = new Set<AvatarCapability>(["state-animation", "reduced-motion"]);
  private container: HTMLElement | undefined;

  async initialize(container: HTMLElement, _manifest: AvatarManifest): Promise<void> {
    this.container = container;
    // Create only local DOM/SVG nodes here. Validate every manifest path first.
  }

  setState(_state: AvatarState): void {}
  trigger(_trigger: AvatarTrigger): void {}
  setSpeechLevel(_level: number): void {}
  setVisible(visible: boolean): void {
    if (this.container) this.container.hidden = !visible;
  }
  resize(_width: number, _height: number, _devicePixelRatio: number): void {}

  dispose(): void {
    this.container?.replaceChildren();
    this.container = undefined;
  }
}
```

Use the shared `AvatarRuntimeKind`, states, triggers, capabilities, and manifest types. Do not add a new event bridge for a renderer. Add focused tests for fallback, visibility pause, invalid assets, bounded resize, and repeated initialize/dispose cycles.

## Webview integration

The Pixi renderer is loaded with `import("@codex-avatar-studio/runtime-pixi")`. It passes frame rate, low-performance mode, particles, reduced motion, and an 8-second initialization timeout. If import or initialization fails, the Webview error boundary selects SVG. Keep optional dependencies out of the initial Webview entry and never require a remote runtime download.

## Manifest selection

`resolveAvatarRuntime` tries the requested runtime, the manifest's preferred runtime, its priority list, the declared fallback, and finally SVG. An adapter must only claim a runtime when its local entrypoint exists and its capabilities are available. See [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md) for the manifest format.
