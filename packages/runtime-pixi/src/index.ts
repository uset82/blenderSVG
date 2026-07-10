import { Application, Graphics } from "pixi.js";
import type {
  AvatarCapability,
  AvatarManifest,
  AvatarRuntimeAdapter,
  AvatarState,
  AvatarTrigger
} from "@codex-avatar-studio/avatar-core";

export const runtimePixiPackageId = "@codex-avatar-studio/runtime-pixi";

export type PixiRuntimeOptions = {
  maxFps?: 30 | 60;
  reducedMotion?: boolean;
};

export type PixiRuntimeDebugInfo = {
  renderer: string;
  width: number;
  height: number;
  devicePixelRatio: number;
  maxFps: number;
  visible: boolean;
  state: AvatarState;
};

export function supportsWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

const capabilities = new Set<AvatarCapability>(["state-animation", "one-shot-triggers", "reduced-motion", "particles"]);

/** Optional PixiJS v8 adapter. It never owns the fallback decision. */
export class PixiAvatarRuntime implements AvatarRuntimeAdapter {
  public readonly kind = "pixi" as const;
  public readonly capabilities = capabilities;
  private application: Application | undefined;
  private avatar: Graphics | undefined;
  private container: HTMLElement | undefined;
  private observer: ResizeObserver | undefined;
  private visibilityHandler: (() => void) | undefined;
  private currentState: AvatarState = "idle";
  private readonly options: PixiRuntimeOptions;

  public constructor(options: PixiRuntimeOptions = {}) {
    this.options = options;
  }

  public async initialize(container: HTMLElement, _manifest: AvatarManifest): Promise<void> {
    this.container = container;
    const application = new Application();
    await application.init({
      preference: "webgl",
      resizeTo: container,
      antialias: !optionsReducedMotion(this.options),
      backgroundAlpha: 0
    });
    this.application = application;
    application.ticker.maxFPS = this.options.maxFps ?? 30;
    container.replaceChildren(application.canvas);
    this.avatar = new Graphics().circle(0, 0, 48).fill(0x60a5fa);
    application.stage.addChild(this.avatar);
    this.resize(container.clientWidth, container.clientHeight, getDevicePixelRatio());
    this.observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.resize(container.clientWidth, container.clientHeight, getDevicePixelRatio());
          });
    this.observer?.observe(container);
    this.visibilityHandler = () => this.setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityHandler();
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
    if (!this.avatar) return;
    const colors: Partial<Record<AvatarState, number>> = {
      idle: 0x60a5fa,
      thinking: 0xa78bfa,
      speaking: 0x5eead4,
      success: 0x3fb950,
      warning: 0xd29922,
      error: 0xf85149
    };
    this.avatar.tint = colors[state] ?? 0x60a5fa;
  }

  public trigger(trigger: AvatarTrigger): void {
    if (trigger === "show-particles") this.avatar?.scale.set(1.12);
    if (trigger === "clear-effects") this.avatar?.scale.set(1);
  }

  public setSpeechLevel(level: number): void {
    this.avatar?.scale.set(1 + Math.max(0, Math.min(1, level)) * 0.12);
  }

  public setVisible(visible: boolean): void {
    if (!this.application) return;
    this.application.stage.visible = visible;
    if (visible) this.application.ticker.start();
    else this.application.ticker.stop();
  }

  public resize(width: number, height: number, devicePixelRatio: number): void {
    if (!this.application || !this.avatar) return;
    this.application.renderer.resolution = Math.min(Math.max(devicePixelRatio, 1), 2);
    this.avatar.position.set(width / 2, height / 2);
  }

  public async dispose(): Promise<void> {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityHandler = undefined;
    this.application?.destroy(true, { children: true, texture: true, textureSource: true });
    this.application = undefined;
    this.avatar = undefined;
    this.container?.replaceChildren();
    this.container = undefined;
  }

  public getDebugInfo(): PixiRuntimeDebugInfo | undefined {
    if (!this.application || !this.container) return undefined;
    return {
      renderer: this.application.renderer.constructor.name,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      devicePixelRatio: this.application.renderer.resolution,
      maxFps: this.application.ticker.maxFPS,
      visible: this.application.stage.visible,
      state: this.currentState
    };
  }
}

function optionsReducedMotion(options: PixiRuntimeOptions): boolean {
  return options.reducedMotion ?? false;
}

function getDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}
