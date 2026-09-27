import { type Editor, type TLAssetStore, type TLComponents, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { AvatarShapeUtil } from "../shapes/AvatarCanvasShape.js";
import { BlenderConnectorShapeUtil } from "../shapes/BlenderConnectorCanvasShape.js";
import { DesignFrameShapeUtil } from "../shapes/DesignFrameShape.js";
import { StudioFrameShapeUtil } from "../shapes/StudioFrameShapeUtil.js";
import { StudioGeoShapeUtil } from "../shapes/StudioGeoShapeUtil.js";
import { VectorStudioShapeUtil } from "../shapes/VectorStudioCanvasShape.js";
import { tldrawAssetUrls } from "../tldrawAssets.js";

const customShapeUtils = [
  AvatarShapeUtil,
  VectorStudioShapeUtil,
  BlenderConnectorShapeUtil,
  StudioGeoShapeUtil,
  StudioFrameShapeUtil,
  DesignFrameShapeUtil
];

// Kurva renders its own canvas menu (StudioCanvasMenu). tldraw's context menu still opens with
// hideUi, on top of Kurva's, and swallows its clicks, so it is turned off.
const canvasComponents: TLComponents = { ContextMenu: null };

export function StudioCanvas({
  editorGeneration,
  licenseKey,
  assets,
  onMount
}: {
  editorGeneration: number;
  licenseKey?: string | undefined;
  assets?: TLAssetStore | undefined;
  onMount: (editor: Editor) => void;
}) {
  return (
    <Tldraw
      key={editorGeneration}
      assetUrls={tldrawAssetUrls}
      hideUi={true}
      colorScheme="light"
      {...(licenseKey ? { licenseKey } : {})}
      {...(assets ? { assets } : {})}
      shapeUtils={customShapeUtils}
      components={canvasComponents}
      onMount={onMount}
    />
  );
}
