import { HTMLContainer, Rectangle2d, ShapeUtil, T } from "tldraw";
import type { BlenderConnectorShape } from "./types.js";

export class BlenderConnectorShapeUtil extends ShapeUtil<BlenderConnectorShape> {
  static override type = "blender-connector" as const;
  static override props = {
    w: T.number,
    h: T.number,
    blenderVersion: T.string,
    isConnected: T.boolean,
    activeScene: T.string,
    lastExport: T.string
  };

  getDefaultProps(): BlenderConnectorShape["props"] {
    return {
      w: 360,
      h: 240,
      blenderVersion: "",
      isConnected: false,
      activeScene: "",
      lastExport: ""
    };
  }

  getGeometry(shape: BlenderConnectorShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: BlenderConnectorShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }

  component(shape: BlenderConnectorShape) {
    return (
      <HTMLContainer
        className="studio-shape studio-shape--blender"
        style={{ width: shape.props.w, height: shape.props.h }}
      >
        <div className="studio-shape__title">Blender integration</div>
        <div className="studio-shape__status" role="status">
          {shape.props.activeScene
            ? `Working copy ${shape.props.activeScene}. The source scene was not modified.`
            : "Send an SVG selection to create a new working copy. No source scene is modified."}
        </div>
        {shape.props.lastExport.startsWith("/assets/") ? (
          <img src={shape.props.lastExport.split("\n")[0]} alt="Blender PNG preview" draggable={false} />
        ) : null}
        {shape.props.lastExport.includes("/api/blender-asset/") ? (
          <a href={shape.props.lastExport.split("\n")[1]}>GLB asset</a>
        ) : null}
      </HTMLContainer>
    );
  }
}
