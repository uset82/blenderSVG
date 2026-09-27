import type { DesignBlock } from "@codex-avatar-studio/studio-agent/designBlocks";
import type { Editor } from "tldraw";
import { executeCanvasTool } from "./executeCanvasTool.js";

/**
 * Places designs a model returned as text (fenced html/svg blocks) on the canvas with the same tools
 * the agent uses, so they are sanitized, sized and placed the same way. Returns one note per block
 * for the saved conversation.
 */
export async function placeDesignBlocks(editor: Editor, blocks: DesignBlock[]): Promise<string[]> {
  const notes: string[] = [];
  let emptyFrameUsed = false;
  for (const block of blocks) {
    try {
      if (block.kind === "svg") {
        const outcome = JSON.parse(
          (await executeCanvasTool(editor, "insert_svg", JSON.stringify({ svg: block.content, width: block.width })))
            .content
        ) as { id?: string };
        notes.push(`Placed the drawing “${block.name}” on the canvas${outcome.id ? ` (${outcome.id})` : ""}`);
        continue;
      }
      const target = block.target ? editor.getShape(block.target as never) : undefined;
      if (target?.type === "design-frame") {
        await executeCanvasTool(
          editor,
          "update_design_frame",
          JSON.stringify({ frameId: block.target, html: block.content, name: block.name })
        );
        notes.push(`Updated “${block.name}” (${block.target}) on the canvas`);
        continue;
      }
      const empty = emptyFrameUsed ? undefined : firstEmptyFrame(editor);
      const outcome = JSON.parse(
        (
          await executeCanvasTool(
            editor,
            "create_design_frame",
            JSON.stringify({
              name: block.complete ? block.name : `${block.name} (cut off)`,
              html: block.content,
              ...(empty ? { intoFrameId: empty } : { width: block.width })
            })
          )
        ).content
      ) as { id?: string; width?: number; height?: number };
      if (empty) emptyFrameUsed = true;
      notes.push(
        `Placed “${block.name}” on the canvas${outcome.id ? ` (${outcome.id}, ${outcome.width}×${outcome.height})` : ""}${
          block.complete ? "" : "; the reply was cut off, so the page may be unfinished"
        }`
      );
    } catch (error) {
      notes.push(
        `Could not place “${block.name}”: ${error instanceof Error ? error.message.slice(0, 200) : "the canvas refused it"}`
      );
    }
  }
  return notes;
}

function firstEmptyFrame(editor: Editor): string | undefined {
  const pageId = editor.getCurrentPageId();
  const shapes = editor.getCurrentPageShapes();
  const parents = new Set(shapes.map((shape) => String(shape.parentId)));
  const frame = shapes.find(
    (shape) => shape.type === "frame" && shape.parentId === pageId && !parents.has(String(shape.id))
  );
  return frame ? String(frame.id) : undefined;
}
