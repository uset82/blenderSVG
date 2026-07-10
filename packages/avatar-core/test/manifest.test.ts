import assert from "node:assert/strict";
import test from "node:test";
import { getLive2DStateBinding, mapLive2DPoseInput, resolveAvatarRuntime, validateAvatarManifest } from "../src/index.js";

const validManifest = {
  version: "0.1.0",
  id: "default-coder-orb",
  name: "Default Coder Orb",
  runtimePriority: ["rive", "svg", "webgl"],
  assets: {
    svg: "avatars/svg/placeholder-avatar.svg",
    rive: "avatars/rive/default.riv"
  },
  states: [
    "idle",
    "welcome",
    "listening",
    "thinking",
    "speaking",
    "coding",
    "reviewing",
    "debugging",
    "building",
    "success",
    "warning",
    "error",
    "sleeping"
  ],
  rive: {
    stateMachine: "CodexAssistant",
    inputs: {
      state: "state",
      wave: "wave"
    }
  }
};

test("validates a complete avatar manifest", () => {
  const result = validateAvatarManifest(validManifest);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.manifest?.id, "default-coder-orb");
  assert.equal(result.manifest?.rive?.stateMachine, "CodexAssistant");
});

test("rejects missing asset IDs and invalid states", () => {
  const result = validateAvatarManifest({
    version: "0.1.0",
    id: "",
    name: "Broken",
    runtimePriority: ["rive", "unknown"],
    assets: {
      svg: ""
    },
    states: ["idle", "not-a-state"]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /id/);
  assert.match(result.errors.join("\n"), /unknown/);
  assert.match(result.errors.join("\n"), /not-a-state/);
});

test("resolves preferred runtime with SVG fallback", () => {
  const manifest = validateAvatarManifest(validManifest).manifest;
  assert.ok(manifest);

  assert.equal(resolveAvatarRuntime("rive", manifest, { rive: true }), "rive");
  assert.equal(resolveAvatarRuntime("webgpu", manifest, { webgpu: true }), "rive");
  assert.equal(resolveAvatarRuntime("rive", manifest, { rive: false }), "svg");
});

test("validates Live2D model3 manifests and custom bindings", () => {
  const result = validateAvatarManifest({
    ...validManifest,
    runtimePriority: ["live2d", "svg"],
    assets: {
      svg: "avatars/svg/placeholder-avatar.svg",
      live2d: "avatars/live2d/default/model.model3.json"
    },
    live2d: {
      model3: "avatars/live2d/default/model.model3.json",
      parameters: {
        mouthOpen: "ParamMouthOpenY",
        angleX: "ParamAngleX",
        angleY: "ParamAngleY",
        breath: "ParamBreath"
      },
      motions: {
        speaking: "TalkLoop"
      },
      expressions: {
        success: "sparkle"
      }
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.manifest?.live2d?.model3, "avatars/live2d/default/model.model3.json");
  assert.equal(result.manifest?.live2d?.motions?.speaking, "TalkLoop");
  assert.equal(result.manifest?.live2d?.expressions?.success, "sparkle");
});

test("maps Live2D state and pose inputs to Cubism parameter IDs", () => {
  const live2d = {
    model3: "avatars/live2d/default/model.model3.json",
    motions: {
      speaking: "TalkLoop"
    },
    expressions: {
      speaking: "talking"
    }
  };

  assert.deepEqual(getLive2DStateBinding("speaking", live2d), {
    motion: "TalkLoop",
    expression: "talking"
  });

  const parameters = mapLive2DPoseInput({
    state: "speaking",
    poseInput: {
      cursorX: 1,
      cursorY: 0,
      mouthOpen: 1.4
    },
    elapsedSeconds: 0,
    live2d
  });

  assert.equal(parameters.ParamMouthOpenY, 1);
  assert.equal(parameters.ParamAngleX, 15);
  assert.equal(parameters.ParamAngleY, 10);
  assert.equal(parameters.ParamBreath, 0.5);
});

test("accepts legacy Live2D model as a model3 alias", () => {
  const result = validateAvatarManifest({
    ...validManifest,
    runtimePriority: ["live2d", "svg"],
    live2d: {
      model: "avatars/live2d/legacy/model.model3.json"
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.manifest?.live2d?.model3, "avatars/live2d/legacy/model.model3.json");
  assert.equal(result.manifest?.live2d?.model, "avatars/live2d/legacy/model.model3.json");
});
