import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from "tldraw";
import type { VectorStudioShape } from "./types.js";

function previewVector(svg: string): { image: { src: string } | null; error: string } {
  if (!svg) return { image: null, error: "" };
  try {
    return { image: prepareSvgPreview(svg), error: "" };
  } catch (error) {
    return { image: null, error: error instanceof Error ? error.message : "SVG preview is invalid." };
  }
}

export class VectorStudioShapeUtil extends ShapeUtil<VectorStudioShape> {
  static override type = "vector-studio" as const;
  static override props = {
    w: T.number,
    h: T.number,
    engine: T.string,
    openRouterModel: T.string,
    detail: T.string,
    lastSvg: T.string,
    isProcessing: T.boolean
  };

  getDefaultProps(): VectorStudioShape["props"] {
    return {
      w: 440,
      h: 640,
      engine: "vtracer",
      openRouterModel: "",
      detail: "balanced",
      lastSvg: "",
      isProcessing: false
    };
  }

  getGeometry(shape: VectorStudioShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: VectorStudioShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }

  component(shape: VectorStudioShape) {
    const preview = previewVector(shape.props.lastSvg);

    return (
      <HTMLContainer
        className="studio-shape studio-shape--vector"
        style={{ width: shape.props.w, height: shape.props.h }}
      >
        <div className="studio-shape__title">Vector preview</div>
        <p className="studio-shape__copy">
          Picture tracing is available in Avatar Studio. This canvas panel will use the local tracing pipeline after its
          host connection is complete.
        </p>

        <div className="studio-shape__preview">
          {preview.image ? (
            <img src={preview.image.src} alt="Sanitized vector preview" draggable={false} />
          ) : (
            <span className="studio-shape__meta" role={preview.error ? "alert" : undefined}>
              {preview.error || "No vector has been added yet."}
            </span>
          )}
        </div>

        <div className="studio-shape__note">
          Text-to-SVG providers and canvas insertion are unavailable while the local asset workflow is being connected.
        </div>
      </HTMLContainer>
    );
  }
}
