import {
  avatarStates,
  isAvatarRuntime,
  isAvatarState,
  live2dParameterChannels,
  type AvatarManifest,
  type AvatarManifestValidationResult,
  type AvatarRuntime,
  type AvatarState,
  type Live2DParameterChannel
} from "./types.js";

export function validateAvatarManifest(input: unknown): AvatarManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(input)) {
    return { valid: false, errors: ["Manifest must be an object."], warnings };
  }

  const version = readString(input, "version", errors);
  const id = readString(input, "id", errors);
  const name = readString(input, "name", errors);
  const runtimePriority = readRuntimePriority(input.runtimePriority, errors);
  const assets = readAssets(input.assets, errors, warnings);
  const states = readStates(input.states, errors, warnings);
  const rive = readRive(input.rive, warnings);
  const live2d = readLive2d(input.live2d, warnings);

  for (const runtime of runtimePriority) {
    if (runtime !== "svg" && !assets[runtime]) {
      warnings.push(`Runtime "${runtime}" is prioritized but has no asset path.`);
    }
  }

  if (!assets.svg) {
    warnings.push("SVG asset is not declared. Runtime fallback can still use bundled defaults.");
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const manifest: AvatarManifest = {
    version,
    id,
    name,
    runtimePriority,
    assets,
    states,
    ...(rive ? { rive } : {}),
    ...(live2d ? { live2d } : {})
  };

  return { valid: true, manifest, errors, warnings };
}

function readString(input: Record<string, unknown>, key: string, errors: string[]): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`Manifest field "${key}" must be a non-empty string.`);
    return "";
  }

  return value;
}

function readRuntimePriority(value: unknown, errors: string[]): AvatarRuntime[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('Manifest field "runtimePriority" must be a non-empty array.');
    return ["svg"];
  }

  const runtimes: AvatarRuntime[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && isAvatarRuntime(entry)) {
      runtimes.push(entry);
    } else {
      errors.push(`Invalid runtimePriority entry "${String(entry)}".`);
    }
  }

  return runtimes.length > 0 ? runtimes : ["svg"];
}

function readAssets(value: unknown, errors: string[], warnings: string[]): Partial<Record<AvatarRuntime, string>> {
  if (!isObject(value)) {
    errors.push('Manifest field "assets" must be an object.');
    return {};
  }

  const assets: Partial<Record<AvatarRuntime, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isAvatarRuntime(key)) {
      warnings.push(`Unknown asset runtime "${key}" was ignored.`);
      continue;
    }

    if (typeof entry !== "string" || entry.trim().length === 0) {
      errors.push(`Asset path for runtime "${key}" must be a non-empty string.`);
      continue;
    }

    assets[key] = entry;
  }

  return assets;
}

function readStates(value: unknown, errors: string[], warnings: string[]): AvatarState[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('Manifest field "states" must be a non-empty array.');
    return [...avatarStates];
  }

  const states: AvatarState[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && isAvatarState(entry)) {
      states.push(entry);
    } else {
      errors.push(`Invalid avatar state "${String(entry)}".`);
    }
  }

  for (const requiredState of avatarStates) {
    if (!states.includes(requiredState)) {
      warnings.push(`Manifest does not list state "${requiredState}".`);
    }
  }

  return states.length > 0 ? states : [...avatarStates];
}

function readRive(value: unknown, warnings: string[]): AvatarManifest["rive"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    warnings.push("Rive manifest section was ignored because it is not an object.");
    return undefined;
  }

  const stateMachine = typeof value.stateMachine === "string" ? value.stateMachine : "";
  if (!stateMachine) {
    warnings.push("Rive section is missing a stateMachine string.");
  }

  return {
    stateMachine,
    inputs: isObject(value.inputs) ? Object.fromEntries(Object.entries(value.inputs).filter(([, entry]) => typeof entry === "string")) : {}
  };
}

function readLive2d(value: unknown, warnings: string[]): AvatarManifest["live2d"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    warnings.push("Live2D manifest section was ignored because it is not an object.");
    return undefined;
  }

  const model3 = readOptionalString(value.model3) ?? readOptionalString(value.model);
  if (!model3) {
    warnings.push("Live2D manifest section was ignored because model3 is missing.");
    return undefined;
  }

  const live2d: NonNullable<AvatarManifest["live2d"]> = { model3 };
  const legacyModel = readOptionalString(value.model);

  if (legacyModel) {
    live2d.model = legacyModel;
  }

  const parameters = readLive2dParameters(value.parameters, warnings);
  if (parameters) {
    live2d.parameters = parameters;
  }

  const motions = readLive2dStateMap(value.motions, "motions", warnings);
  if (motions) {
    live2d.motions = motions;
  }

  const expressions = readLive2dStateMap(value.expressions, "expressions", warnings);
  if (expressions) {
    live2d.expressions = expressions;
  }

  return live2d;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readLive2dParameters(
  value: unknown,
  warnings: string[]
): NonNullable<AvatarManifest["live2d"]>["parameters"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    warnings.push("Live2D parameters were ignored because they are not an object.");
    return undefined;
  }

  const parameters: Partial<Record<Live2DParameterChannel, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!(live2dParameterChannels as readonly string[]).includes(key)) {
      warnings.push(`Unknown Live2D parameter channel "${key}" was ignored.`);
      continue;
    }

    if (typeof entry !== "string" || entry.trim().length === 0) {
      warnings.push(`Live2D parameter "${key}" was ignored because it is not a non-empty string.`);
      continue;
    }

    parameters[key as Live2DParameterChannel] = entry;
  }

  return Object.keys(parameters).length > 0 ? parameters : undefined;
}

function readLive2dStateMap(
  value: unknown,
  label: "motions" | "expressions",
  warnings: string[]
): Partial<Record<AvatarState, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isObject(value)) {
    warnings.push(`Live2D ${label} were ignored because they are not an object.`);
    return undefined;
  }

  const stateMap: Partial<Record<AvatarState, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isAvatarState(key)) {
      warnings.push(`Unknown Live2D ${label} state "${key}" was ignored.`);
      continue;
    }

    if (typeof entry !== "string" || entry.trim().length === 0) {
      warnings.push(`Live2D ${label} entry "${key}" was ignored because it is not a non-empty string.`);
      continue;
    }

    stateMap[key] = entry;
  }

  return Object.keys(stateMap).length > 0 ? stateMap : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
