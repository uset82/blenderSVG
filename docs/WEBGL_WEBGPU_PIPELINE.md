# WebGL / WebGPU Pipeline

WebGL is the stable default for 3D avatar rendering. WebGPU is a progressive enhancement that is only attempted when the user selects the `webgpu` runtime and the webview reports `navigator.gpu` support.

Fallback chain:

1. `webgpu` setting + WebGPU support: lazy-load Three's WebGPU renderer.
2. WebGPU unavailable or initialization fails: use WebGL2 when available.
3. WebGL2 unavailable or rendering fails: return to the SVG renderer.

The 3D renderer is loaded through React lazy imports from `AvatarStage`, so SVG and Rive sessions do not load Three.js. GLB loading is also deferred: `WebGLAvatarRenderer` looks for `manifest.assets.webgl` or `manifest.assets.webgpu`, imports `GLTFLoader` only when a non-empty asset URI exists, and keeps the built-in placeholder mascot visible if the GLB is missing or fails to load.

The placeholder mascot is a small Three.js orb with face, antenna, orbit ring, and thinking dots. It responds to avatar state, cursor pose, mouth openness, and trigger events so GPU mode remains useful before a custom GLB exists.

The renderer owns a requestAnimationFrame loop and pauses it while `document.visibilityState === "hidden"`. It cleans up loaded GLB geometry/materials, placeholder geometry/materials, resize observers, event listeners, canvases, and renderer resources when the runtime changes or the webview unmounts.

For standalone browser previews without a VS Code bootstrap payload, use `?runtime=webgl` or `?runtime=webgpu` to seed the fallback config. In dev mode, WebGL canvases add a `data-debug-lit-pixels` value after render so automated checks can verify that the framebuffer is nonblank.
