import { useLayoutEffect, useRef } from "react";
import { HTMLContainer, Rectangle2d, resizeBox, ShapeUtil, T, type TLResizeInfo } from "tldraw";
import { mountDesignDocument } from "./designFrameRenderer.js";
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
    return { w: 1440, h: 900, name: "Design", html: "" };
  }

  getGeometry(shape: DesignFrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override onResize(shape: DesignFrameShape, info: TLResizeInfo<DesignFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: DesignFrameShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, background: "#fff", overflow: "hidden" }}>
        <DesignFrameDocument html={shape.props.html} title={shape.props.name || "Design frame"} />
      </HTMLContainer>
    );
  }

  override getIndicatorPath(shape: DesignFrameShape): Path2D {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

/**
 * The design renders in a sandboxed iframe without `allow-scripts`. The page fills the iframe's DOM
 * (see designFrameRenderer), so the design's CSS works under the host's `style-src 'self'` CSP.
 */
function DesignFrameDocument({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useLayoutEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const mount = () => {
      mountDesignDocument(iframe, html);
    };
    mount();
    // Some engines replace the initial about:blank document once it "loads"; fill it again then.
    iframe.addEventListener("load", mount);
    return () => iframe.removeEventListener("load", mount);
  }, [html]);
  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-same-origin"
      tabIndex={-1}
      style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none", display: "block" }}
    />
  );
}
