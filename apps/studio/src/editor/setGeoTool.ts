import { type Editor, GeoShapeGeoStyle } from "tldraw";

export function setGeoTool(editor: Editor, tool: "rectangle" | "ellipse"): void {
  editor.setStyleForNextShapes(GeoShapeGeoStyle, tool === "rectangle" ? "rectangle" : "ellipse");
  editor.setCurrentTool("geo");
}
