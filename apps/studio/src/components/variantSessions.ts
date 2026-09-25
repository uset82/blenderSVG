export interface VariantFrameEditor {
  markHistoryStoppingPoint: (name: string) => void;
  createShape: (shape: { type: string; x: number; y: number; props: Record<string, unknown> }) => void;
  getCurrentPageShapes: () => Array<{ id: string; type: string; props: { name?: string } }>;
  deleteShapes: (ids: string[]) => void;
}

export interface VariantSession {
  index: number;
  frameId: string;
  name: string;
}

export function variantPrompt(message: string, index: number, count: number): string {
  const total = Math.min(4, Math.max(1, Math.floor(count)));
  return `${message.trim()}\n\nDraw variant ${index + 1} of ${total} inside the frame named Variant ${index + 1}.`;
}

export function placeVariantFrames(editor: VariantFrameEditor, count: number): VariantSession[] {
  const total = Math.min(4, Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
  const frames = Array.from({ length: total }, (_, index) => ({
    index,
    x: index * 848,
    y: 0,
    w: 800,
    h: 600
  }));
  editor.markHistoryStoppingPoint("variant frames");
  for (const frame of frames) {
    editor.createShape({
      type: "frame",
      x: frame.x,
      y: frame.y,
      props: { w: frame.w, h: frame.h, name: `Variant ${frame.index + 1}` }
    });
  }
  return frames.flatMap((frame) => {
    const name = `Variant ${frame.index + 1}`;
    const shape = editor.getCurrentPageShapes().find((item) => item.type === "frame" && item.props.name === name);
    return shape ? [{ index: frame.index, frameId: shape.id, name }] : [];
  });
}

export function keepVariantFrame(
  editor: VariantFrameEditor,
  sessions: readonly VariantSession[],
  keepIndex: number
): void {
  const discarded = sessions.filter((session) => session.index !== keepIndex).map((session) => session.frameId);
  if (discarded.length) editor.deleteShapes(discarded);
}
