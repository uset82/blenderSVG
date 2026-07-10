import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManifest } from "@codex-avatar-studio/avatar-core";

const pixiState = vi.hoisted(() => ({
  applications: [] as Array<{
    canvas: object;
    destroy: ReturnType<typeof vi.fn>;
    initOptions: unknown;
    stage: { addChild: ReturnType<typeof vi.fn>; visible: boolean };
    ticker: { maxFPS: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  }>,
  nextInitError: null as Error | null
}));

vi.mock("pixi.js", () => {
  class MockApplication {
    public readonly canvas = {};
    public readonly stage = { addChild: vi.fn(), visible: true };
    public readonly renderer = { resolution: 1 };
    public readonly ticker = { maxFPS: 0, start: vi.fn(), stop: vi.fn() };
    public readonly destroy = vi.fn();
    public initOptions: unknown = undefined;

    public constructor() {
      pixiState.applications.push(this);
    }

    public async init(options: unknown): Promise<void> {
      this.initOptions = options;
      if (pixiState.nextInitError) {
        const error = pixiState.nextInitError;
        pixiState.nextInitError = null;
        throw error;
      }
    }

    public destroyApplication(): void {
      this.destroy();
    }
  }

  class MockGraphics {
    public tint = 0;
    public readonly position = { set: vi.fn() };
    public readonly scale = { set: vi.fn() };

    public circle(): this {
      return this;
    }

    public fill(): this {
      return this;
    }
  }

  return {
    Application: MockApplication,
    Assets: { load: vi.fn() },
    Graphics: MockGraphics
  };
});

import { PixiAvatarRuntime } from "../src/index.js";

const manifest = {
  schemaVersion: 1,
  id: "test-avatar",
  name: "Test Avatar",
  version: "0.1.0",
  author: "Tests",
  license: "MIT",
  preferredRuntime: "pixi",
  fallbackRuntime: "svg",
  entrypoints: { svg: "avatar.svg" },
  capabilities: ["state-animation"],
  states: { idle: "idle_loop" }
} as AvatarManifest;

let visibilityHandler: (() => void) | undefined;

function createContainer() {
  const pixiChildren: unknown[] = [];
  const replaceChildren = vi.fn((...nextChildren: unknown[]) => {
    pixiChildren.splice(0, pixiChildren.length, ...nextChildren);
  });

  return {
    clientWidth: 320,
    clientHeight: 180,
    pixiChildren,
    replaceChildren
  } as unknown as HTMLElement & { pixiChildren: unknown[] };
}

beforeEach(() => {
  pixiState.applications.length = 0;
  pixiState.nextInitError = null;
  visibilityHandler = undefined;
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: (event: string, handler: unknown) => {
      if (event === "visibilitychange" && typeof handler === "function") {
        visibilityHandler = handler as () => void;
      }
    },
    removeEventListener: vi.fn()
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      public observe = vi.fn();
      public disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PixiAvatarRuntime lifecycle", () => {
  it("initializes one application and disposes its resources", async () => {
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(container, manifest);

    expect(pixiState.applications).toHaveLength(1);
    expect(container.replaceChildren).toHaveBeenCalledWith(pixiState.applications[0]?.canvas);
    expect(runtime.getDebugInfo()?.renderer).toBe("Object");

    await runtime.dispose();

    expect(pixiState.applications[0]?.destroy).toHaveBeenCalledWith(true, {
      children: true,
      texture: false,
      textureSource: false
    });
    expect(container.replaceChildren).toHaveBeenLastCalledWith();
    expect(container.pixiChildren).toHaveLength(0);
  });

  it("disposes the old application before reinitializing", async () => {
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(container, manifest);
    await runtime.initialize(container, manifest);

    expect(pixiState.applications).toHaveLength(2);
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    expect(pixiState.applications[1]?.destroy).not.toHaveBeenCalled();
    expect(container.pixiChildren).toHaveLength(1);
  });

  it("pauses and resumes rendering with visibility", async () => {
    const runtime = new PixiAvatarRuntime();
    await runtime.initialize(createContainer(), manifest);
    const application = pixiState.applications[0];

    runtime.setVisible(false);
    expect(application?.stage.visible).toBe(false);
    expect(application?.ticker.stop).toHaveBeenCalled();

    runtime.setVisible(true);
    expect(application?.stage.visible).toBe(true);
    expect(application?.ticker.start).toHaveBeenCalled();
  });

  it("pauses rendering when the document becomes hidden", async () => {
    const runtime = new PixiAvatarRuntime();
    await runtime.initialize(createContainer(), manifest);
    const application = pixiState.applications[0];
    const documentStub = document as unknown as { visibilityState: "hidden" | "visible" };

    documentStub.visibilityState = "hidden";
    visibilityHandler?.();

    expect(application?.stage.visible).toBe(false);
    expect(application?.ticker.stop).toHaveBeenCalled();
  });

  it("tries WebGPU when WebGL initialization fails and WebGPU is available", async () => {
    vi.stubGlobal("navigator", { gpu: {} });
    pixiState.nextInitError = new Error("WebGL unavailable");
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(createContainer(), manifest);

    expect(pixiState.applications).toHaveLength(2);
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    const fallbackApplication = pixiState.applications[1];
    if (!fallbackApplication) throw new Error("Expected a WebGPU fallback application.");
    expect((fallbackApplication.initOptions as { preference: string }).preference).toBe("webgpu");
  });

  it("cleans up a partially initialized application and rejects the failure", async () => {
    pixiState.nextInitError = new Error("WebGL unavailable");
    const runtime = new PixiAvatarRuntime();

    await expect(runtime.initialize(createContainer(), manifest)).rejects.toThrow("WebGL unavailable");
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
  });
});
