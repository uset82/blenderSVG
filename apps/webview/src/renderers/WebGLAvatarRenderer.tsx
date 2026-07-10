import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  supportsWebGL2,
  supportsWebGPU,
  type AvatarManifest,
  type AvatarPoseInput,
  type AvatarRuntime,
  type AvatarState,
  type AvatarTrigger
} from "@codex-avatar-studio/avatar-core";
import * as THREE from "three";

type GpuRuntime = Extract<AvatarRuntime, "webgl" | "webgpu">;
type EffectiveRuntime = GpuRuntime | "svg";

type WebGLAvatarRendererProps = {
  requestedRuntime: GpuRuntime;
  state: AvatarState;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  fallback: ReactNode;
};

type GpuSupport = {
  webgl2: boolean;
  webgpu: boolean;
};

type AvatarThreeRenderer = {
  domElement: HTMLCanvasElement;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  setPixelRatio: (value: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  dispose: () => void;
};

type PlaceholderMascot = {
  root: THREE.Group;
  orb: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  eyes: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>;
  mouth: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  antenna: THREE.Group;
  dots: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>;
};

type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: AvatarThreeRenderer;
  mascot: PlaceholderMascot;
  elapsedSeconds: number;
  lastFrameAt: number;
  gltfRoot: THREE.Object3D | null;
  gltfBaseScale: number;
};

type TriggerPulse = {
  trigger: AvatarTrigger;
  startedAt: number;
};

const STATE_COLORS: Record<AvatarState, number> = {
  idle: 0x55b7ff,
  welcome: 0x66d9e8,
  listening: 0x8bd17c,
  thinking: 0xa78bfa,
  speaking: 0x4fd1c5,
  coding: 0x58a6ff,
  reviewing: 0xf0b86e,
  debugging: 0xff8a65,
  building: 0x7dd3fc,
  success: 0x3fb950,
  warning: 0xd29922,
  error: 0xf85149,
  sleeping: 0x7f8ea3
};

export function WebGLAvatarRenderer({
  requestedRuntime,
  state,
  poseInput,
  manifest,
  triggerEvent,
  fallback
}: WebGLAvatarRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const stateRef = useRef(state);
  const poseInputRef = useRef(poseInput);
  const triggerRef = useRef<TriggerPulse | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const [activeRuntime, setActiveRuntime] = useState<GpuRuntime | null>(null);
  const support = useMemo(detectGpuSupport, []);
  const preferredRuntime = getPreferredRuntime(requestedRuntime, support);
  const glbAsset = useMemo(() => resolveGlbAsset(manifest, requestedRuntime), [manifest, requestedRuntime]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    poseInputRef.current = poseInput;
  }, [poseInput]);

  useEffect(() => {
    setRuntimeFailed(false);
  }, [requestedRuntime]);

  useEffect(() => {
    if (!triggerEvent) {
      return;
    }

    triggerRef.current = {
      trigger: triggerEvent.trigger,
      startedAt: performance.now()
    };
  }, [triggerEvent]);

  useEffect(() => {
    if (runtimeFailed || preferredRuntime === "svg") {
      sceneRefs.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame: number | null = null;
    let currentRefs: SceneRefs | null = null;

    setActiveRuntime(null);

    const stopLoop = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const startLoop = () => {
      if (animationFrame !== null || cancelled || document.visibilityState === "hidden") {
        return;
      }

      animationFrame = requestAnimationFrame(renderLoop);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopLoop();
      } else {
        if (currentRefs) {
          currentRefs.lastFrameAt = performance.now();
        }
        startLoop();
      }
    };

    const resize = () => {
      if (!currentRefs) {
        return;
      }

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight || width, 1);
      currentRefs.camera.aspect = width / height;
      currentRefs.camera.updateProjectionMatrix();
      currentRefs.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      currentRefs.renderer.setSize(width, height, false);
    };

    function renderLoop() {
      const refs = currentRefs;
      if (!refs || cancelled || document.visibilityState === "hidden") {
        animationFrame = null;
        return;
      }

      const now = performance.now();
      const delta = Math.min((now - refs.lastFrameAt) / 1000, 0.1);
      refs.lastFrameAt = now;
      refs.elapsedSeconds += delta;
      updateScene(refs, delta, refs.elapsedSeconds, now, stateRef.current, poseInputRef.current, triggerRef);

      try {
        refs.renderer.render(refs.scene, refs.camera);
        updateDevCanvasDiagnostics(refs.renderer);
      } catch (error) {
        console.warn("[Codex Avatar] Three renderer failed", error);
        stopLoop();
        setRuntimeFailed(true);
        return;
      }

      animationFrame = requestAnimationFrame(renderLoop);
    }

    void (async () => {
      try {
        const created = await createRenderer(preferredRuntime, support);
        if (cancelled) {
          created.renderer.dispose();
          return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
        camera.position.set(0, 0, 5.1);

        const mascot = createPlaceholderMascot();
        scene.add(mascot.root);
        scene.add(new THREE.AmbientLight(0xffffff, 1.7));

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
        keyLight.position.set(2.8, 3.6, 4.4);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.95);
        fillLight.position.set(-3.2, -1.2, 2.1);
        scene.add(fillLight);

        currentRefs = {
          scene,
          camera,
          renderer: created.renderer,
          mascot,
          elapsedSeconds: 0,
          lastFrameAt: performance.now(),
          gltfRoot: null,
          gltfBaseScale: 1
        };
        sceneRefs.current = currentRefs;

        created.renderer.domElement.setAttribute("aria-hidden", "true");
        created.renderer.domElement.dataset.gpuRuntime = created.runtime;
        container.replaceChildren(created.renderer.domElement);

        resize();
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(container);
        } else {
          window.addEventListener("resize", resize);
        }

        document.addEventListener("visibilitychange", onVisibilityChange);
        setActiveRuntime(created.runtime);
        updateScene(currentRefs, 0, 0, performance.now(), stateRef.current, poseInputRef.current, triggerRef);
        created.renderer.render(scene, camera);
        updateDevCanvasDiagnostics(created.renderer);
        startLoop();
      } catch (error) {
        if (!cancelled) {
          console.warn("[Codex Avatar] GPU runtime unavailable", error);
          setRuntimeFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopLoop();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (currentRefs) {
        removeLoadedModel(currentRefs);
        disposeObject3D(currentRefs.mascot.root);
        currentRefs.renderer.domElement.remove();
        currentRefs.renderer.dispose();
      }

      if (sceneRefs.current === currentRefs) {
        sceneRefs.current = null;
      }
    };
  }, [preferredRuntime, runtimeFailed, support]);

  useEffect(() => {
    if (!activeRuntime || runtimeFailed || !glbAsset) {
      return;
    }

    const refs = sceneRefs.current;
    if (!refs) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(glbAsset);

        if (cancelled) {
          disposeObject3D(gltf.scene);
          return;
        }

        removeLoadedModel(refs);
        const model = normalizeLoadedModel(gltf.scene);
        refs.gltfRoot = model;
        refs.gltfBaseScale = model.scale.x || 1;
        refs.scene.add(model);
        refs.mascot.root.visible = false;
      } catch (error) {
        if (!cancelled) {
          console.warn("[Codex Avatar] GLB avatar asset failed to load; using placeholder", error);
          refs.mascot.root.visible = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      removeLoadedModel(refs);
      refs.mascot.root.visible = true;
    };
  }, [activeRuntime, glbAsset, runtimeFailed]);

  if (preferredRuntime === "svg" || runtimeFailed) {
    return fallback;
  }

  return (
    <div
      ref={containerRef}
      className="webgl-runtime"
      data-avatar-state={state}
      data-requested-runtime={requestedRuntime}
      data-active-runtime={activeRuntime ?? preferredRuntime}
    />
  );
}

function detectGpuSupport(): GpuSupport {
  return {
    webgl2: safeSupportsWebGL2(),
    webgpu: safeSupportsWebGPU()
  };
}

function safeSupportsWebGL2(): boolean {
  try {
    return supportsWebGL2();
  } catch {
    return false;
  }
}

function safeSupportsWebGPU(): boolean {
  try {
    return supportsWebGPU();
  } catch {
    return false;
  }
}

function getPreferredRuntime(requestedRuntime: GpuRuntime, support: GpuSupport): EffectiveRuntime {
  if (requestedRuntime === "webgpu" && support.webgpu) {
    return "webgpu";
  }

  if (support.webgl2) {
    return "webgl";
  }

  return "svg";
}

async function createRenderer(
  preferredRuntime: EffectiveRuntime,
  support: GpuSupport
): Promise<{ renderer: AvatarThreeRenderer; runtime: GpuRuntime }> {
  if (preferredRuntime === "webgpu" && support.webgpu) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer({ alpha: true, antialias: true });
      await renderer.init();
      return { renderer: renderer as unknown as AvatarThreeRenderer, runtime: "webgpu" };
    } catch (error) {
      console.warn("[Codex Avatar] WebGPU renderer failed; trying WebGL2 fallback", error);
    }
  }

  if (!support.webgl2) {
    throw new Error("WebGL2 is unavailable");
  }

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: true
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return { renderer, runtime: "webgl" };
}

function resolveGlbAsset(manifest: AvatarManifest, requestedRuntime: GpuRuntime): string | null {
  const requestedAsset = normalizeAssetPath(manifest.assets[requestedRuntime]);
  if (requestedAsset) {
    return requestedAsset;
  }

  return normalizeAssetPath(requestedRuntime === "webgpu" ? manifest.assets.webgl : manifest.assets.webgpu);
}

function normalizeAssetPath(asset: string | undefined): string | null {
  const trimmedAsset = asset?.trim();
  return trimmedAsset ? trimmedAsset : null;
}

function createPlaceholderMascot(): PlaceholderMascot {
  const root = new THREE.Group();
  root.name = "CodexAvatarPlaceholderRoot";

  const orbMaterial = new THREE.MeshBasicMaterial({
    color: STATE_COLORS.idle,
    transparent: false
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), orbMaterial);
  orb.name = "CodexAvatarOrb";
  root.add(orb);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x9bdcff, transparent: true, opacity: 0.66 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.018, 12, 96), ringMaterial);
  ring.rotation.x = Math.PI / 2.55;
  ring.rotation.y = -0.24;
  ring.name = "CodexAvatarOrbitRing";
  root.add(ring);

  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x08111f });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), faceMaterial);
  leftEye.position.set(-0.25, 0.18, 0.91);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.25;
  const eyes = [leftEye, rightEye];
  eyes.forEach(eye => {
    eye.name = "CodexAvatarEye";
    root.add(eye);
  });

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.035), faceMaterial);
  mouth.name = "CodexAvatarMouth";
  mouth.position.set(0, -0.17, 0.94);
  root.add(mouth);

  const antenna = new THREE.Group();
  antenna.name = "CodexAvatarAntenna";
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.03, 0.42, 14),
    new THREE.MeshBasicMaterial({ color: 0x9bdcff })
  );
  stalk.position.y = 1.16;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshBasicMaterial({ color: 0x58a6ff }));
  tip.position.y = 1.4;
  antenna.add(stalk, tip);
  root.add(antenna);

  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.84 });
  const dots = Array.from({ length: 3 }, (_, index) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), dotMaterial.clone());
    dot.name = "CodexAvatarThinkingDot";
    dot.position.set((index - 1) * 0.22, 0.62, 0.9);
    dot.visible = false;
    root.add(dot);
    return dot;
  });

  return { root, orb, ring, eyes, mouth, antenna, dots };
}

function updateScene(
  refs: SceneRefs,
  delta: number,
  elapsed: number,
  now: number,
  state: AvatarState,
  poseInput: AvatarPoseInput,
  triggerRef: MutableRefObject<TriggerPulse | null>
): void {
  const color = new THREE.Color(STATE_COLORS[state]);
  const cursorX = poseInput.cursorX ?? 0.5;
  const cursorY = poseInput.cursorY ?? 0.5;
  const lookX = (cursorX - 0.5) * 0.42;
  const lookY = (cursorY - 0.5) * 0.3;
  const intensity = getStateIntensity(state);
  const bob = Math.sin(elapsed * (1.5 + intensity * 2.2)) * (0.018 + intensity * 0.036);

  updatePlaceholder(refs.mascot, color, delta, elapsed, now, state, poseInput, lookX, lookY, bob, triggerRef);
  updateLoadedModel(refs, delta, elapsed, state, lookX, lookY, bob, triggerRef.current);
}

function updatePlaceholder(
  mascot: PlaceholderMascot,
  color: THREE.Color,
  delta: number,
  elapsed: number,
  now: number,
  state: AvatarState,
  poseInput: AvatarPoseInput,
  lookX: number,
  lookY: number,
  bob: number,
  triggerRef: MutableRefObject<TriggerPulse | null>
): void {
  const intensity = getStateIntensity(state);
  const mouthOpen = state === "speaking" ? Math.max(0.18, poseInput.mouthOpen ?? 0.5) : 0;
  const sleeping = state === "sleeping";
  const thinking = state === "thinking" || state === "building" || state === "reviewing";
  const baseScale = sleeping ? 0.88 : 1 + Math.sin(elapsed * 2.2) * (0.012 + intensity * 0.012);

  mascot.orb.material.color.lerp(color, 0.12);

  mascot.root.position.set(state === "error" ? Math.sin(elapsed * 36) * 0.055 : 0, bob - (sleeping ? 0.08 : 0), 0);
  mascot.root.scale.setScalar(baseScale);
  mascot.root.rotation.x = THREE.MathUtils.lerp(mascot.root.rotation.x, -lookY, 0.08);
  mascot.root.rotation.y = THREE.MathUtils.lerp(mascot.root.rotation.y, lookX, 0.08);
  mascot.root.rotation.z = THREE.MathUtils.lerp(mascot.root.rotation.z, state === "warning" ? Math.sin(elapsed * 8) * 0.035 : 0, 0.1);

  mascot.ring.material.color.lerp(color, 0.1);
  mascot.ring.material.opacity = sleeping ? 0.25 : 0.52 + intensity * 0.28;
  mascot.ring.rotation.z += delta * (0.35 + intensity * 1.8);

  const blink = sleeping || Math.sin(elapsed * 4.7) > 0.985 ? 0.14 : 1;
  mascot.eyes.forEach((eye, index) => {
    eye.scale.set(1, blink, 1);
    eye.position.y = 0.18 + (thinking ? Math.sin(elapsed * 4 + index) * 0.018 : 0);
  });

  mascot.mouth.scale.set(0.88 + mouthOpen * 0.44, sleeping ? 0.22 : 0.75 + mouthOpen * 2.8, 1);
  mascot.mouth.position.y = -0.17 - mouthOpen * 0.02;

  mascot.antenna.rotation.z = Math.sin(elapsed * (1.4 + intensity * 2)) * (0.04 + intensity * 0.08);

  mascot.dots.forEach((dot, index) => {
    dot.visible = thinking;
    dot.position.y = 0.62 + Math.sin(elapsed * 5.2 + index * 0.7) * 0.06;
    dot.material.opacity = thinking ? 0.44 + Math.sin(elapsed * 5.2 + index * 0.7) * 0.28 : 0;
  });

  applyTriggerPulse(mascot, now, triggerRef);
}

function updateLoadedModel(
  refs: SceneRefs,
  delta: number,
  elapsed: number,
  state: AvatarState,
  lookX: number,
  lookY: number,
  bob: number,
  trigger: TriggerPulse | null
): void {
  const model = refs.gltfRoot;
  if (!model) {
    return;
  }

  const intensity = getStateIntensity(state);
  const triggerBoost = trigger ? getTriggerProgress(trigger, performance.now()).pulse : 0;
  const scale = refs.gltfBaseScale * (1 + intensity * 0.035 + triggerBoost * 0.12);
  model.scale.setScalar(scale);
  model.position.y = bob;
  model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, -lookY * 0.45, 0.08);
  model.rotation.y += delta * (0.28 + intensity * 0.72);
  model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, model.rotation.y + lookX * 0.02, 0.08);
  model.rotation.z = state === "error" ? Math.sin(elapsed * 30) * 0.035 : 0;
}

function applyTriggerPulse(
  mascot: PlaceholderMascot,
  now: number,
  triggerRef: MutableRefObject<TriggerPulse | null>
): void {
  const trigger = triggerRef.current;
  if (!trigger) {
    return;
  }

  const progress = getTriggerProgress(trigger, now);
  const tail = 1 - progress.linear;

  switch (trigger.trigger) {
    case "wave":
      mascot.antenna.rotation.z += Math.sin(progress.linear * Math.PI * 5) * 0.36 * tail;
      break;
    case "nod":
      mascot.root.rotation.x += Math.sin(progress.linear * Math.PI * 2) * 0.24 * tail;
      break;
    case "shakeHead":
    case "confused":
      mascot.root.rotation.y += Math.sin(progress.linear * Math.PI * 6) * 0.25 * tail;
      break;
    case "celebrate":
    case "pulse":
    case "wake":
      mascot.root.scale.multiplyScalar(1 + progress.pulse * 0.16);
      break;
    case "point":
      mascot.ring.rotation.y += Math.sin(progress.linear * Math.PI * 2) * 0.28 * tail;
      break;
    case "sleep":
    case "blink":
      mascot.eyes.forEach(eye => eye.scale.set(1, 0.12 + progress.pulse * 0.35, 1));
      break;
  }

  if (progress.linear >= 1) {
    triggerRef.current = null;
  }
}

function getTriggerProgress(trigger: TriggerPulse, now: number): { linear: number; pulse: number } {
  const linear = Math.min((now - trigger.startedAt) / 850, 1);
  return {
    linear,
    pulse: Math.sin(linear * Math.PI)
  };
}

function getStateIntensity(state: AvatarState): number {
  switch (state) {
    case "thinking":
    case "coding":
    case "debugging":
    case "building":
      return 0.8;
    case "speaking":
    case "success":
    case "warning":
    case "error":
      return 1;
    case "sleeping":
      return 0;
    default:
      return 0.35;
  }
}

function normalizeLoadedModel(model: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? 2.1 / maxAxis : 1;

  model.position.sub(center);
  model.scale.setScalar(scale);
  model.traverse(child => {
    child.frustumCulled = false;
  });

  return model;
}

function removeLoadedModel(refs: SceneRefs): void {
  if (!refs.gltfRoot) {
    return;
  }

  refs.scene.remove(refs.gltfRoot);
  disposeObject3D(refs.gltfRoot);
  refs.gltfRoot = null;
  refs.gltfBaseScale = 1;
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    mesh.geometry?.dispose();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(material => material.dispose());
    } else {
      mesh.material?.dispose();
    }
  });
}

function updateDevCanvasDiagnostics(renderer: AvatarThreeRenderer): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const webglRenderer = renderer as AvatarThreeRenderer & {
    getContext?: () => WebGLRenderingContext | WebGL2RenderingContext;
  };
  const gl = webglRenderer.getContext?.();
  if (!gl || typeof gl.readPixels !== "function") {
    return;
  }

  try {
    const width = Math.max(renderer.domElement.width, 1);
    const height = Math.max(renderer.domElement.height, 1);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let litPixels = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index] || pixels[index + 1] || pixels[index + 2] || pixels[index + 3]) {
        litPixels += 1;
      }
    }

    renderer.domElement.dataset.debugLitPixels = String(litPixels);
  } catch {
    renderer.domElement.dataset.debugLitPixels = "unavailable";
  }
}
