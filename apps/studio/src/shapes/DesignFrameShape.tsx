import { HTMLContainer, Rectangle2d, ShapeUtil, T, resizeBox, type TLResizeInfo } from "tldraw";
import { designFrameSrcDoc } from "./designFrameHtml.js";
import type { DesignFrameShape } from "./types.js";

export class DesignFrameShapeUtil extends ShapeUtil<DesignFrameShape> {
  static override type = "design-frame" as const;
  static override props = {
    w: T.number,
    h: T.number,
    name: T.string,
    html: T.string
  };

  override canResize() {
    return true;
  }

  getDefaultProps(): DesignFrameShape["props"] {
    return { w: 800, h: 600, name: "Design", html: "" };
  }

  getGeometry(shape: DesignFrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override onResize(shape: DesignFrameShape, info: TLResizeInfo<DesignFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: DesignFrameShape) {
    const srcDoc = designFrameSrcDoc(shape.props.html);
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }}>
        <iframe
          title={shape.props.name || "Design frame"}
          sandbox=""
          srcDoc={srcDoc}
          style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
        />
      </HTMLContainer>
    );
  }

  override getIndicatorPath(shape: DesignFrameShape): Path2D {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}
