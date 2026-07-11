export const supportedImageExtensions = [".png", ".jpg", ".jpeg", ".webp"] as const;

export type SupportedImageExtension = (typeof supportedImageExtensions)[number];

export type VectorizeImageOptions = {
  inputPath: string;
  workspaceRoot: string;
  assetWorkspace?: string;
  threshold?: number;
  signal?: AbortSignal;
  maxSvgBytes?: number;
  maxSvgPaths?: number;
  preprocessing?: RasterPreprocessingOptions;
};

export type RasterPreprocessingOptions = {
  grayscale?: boolean;
  threshold?: number;
  quantizationLevels?: 2 | 4 | 8 | 16;
  removeBackground?: boolean;
  noiseReduction?: number;
};

export type VectorizePreview = {
  inputPath: string;
  exportDirectory: string;
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  rawSvg: string;
  optimizedSvg: string;
  warnings: string[];
};

export type VectorizeImageResult = {
  inputPath: string;
  exportDirectory: string;
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  warnings: string[];
};

export type SvgValidationResult = {
  valid: boolean;
  profile: SvgLayerProfile;
  warnings: string[];
  requiredLayers: string[];
  missingLayers: string[];
  unnamedGroups: number;
  tinyPathCount: number;
  pathCount: number;
  groupCount: number;
  byteLength: number;
};

export type SvgLayerProfile = "reference" | "humanoid" | "orb";

export type SvgValidationOptions = {
  profile?: SvgLayerProfile;
  maxBytes?: number;
  maxPaths?: number;
  tinyPathDataLength?: number;
  maxTinyPaths?: number;
};

export type AssetManifestEntry = {
  version: string;
  id: string;
  name: string;
  source: {
    type: "image-trace";
    path: string;
  };
  outputs: {
    rawSvg: string;
    optimizedSvg: string;
  };
  guidance: string;
  warnings: string[];
  createdAt: string;
};
