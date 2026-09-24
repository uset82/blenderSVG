import { DefaultColorStyle, type Editor, FrameShapeUtil } from "tldraw";

/** Enables tldraw's built-in per-color frame fill while retaining its clipping behavior. */
export class StudioFrameShapeUtil extends FrameShapeUtil {
  static override props = {
    ...FrameShapeUtil.props,
    color: DefaultColorStyle
  };

  constructor(editor: Editor) {
    super(editor);
    this.options = { ...this.options, showColors: true };
  }
}
