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
          Studio does not read Blender status or export from this canvas yet. No scene, version, or connection state is
          available here.
        </div>
      </HTMLContainer>
    );
  }
}
