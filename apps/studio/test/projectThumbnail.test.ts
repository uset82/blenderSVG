import type { Editor } from "tldraw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelFrameThumbnail,
  cancelScheduledFrameThumbnails,
  scheduleFrameThumbnail,
  storeFrameThumbnail
} from "../src/components/projectThumbnail.js";

const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";

function makeEditor(frameId: string): Editor {
  return {
    getCurrentPageShapes: vi.fn(() => [{ id: frameId, type: "frame" }]),
    toImage: vi.fn(async () => ({ blob: new Blob(["png"], { type: "image/png" }) }))
  } as unknown as Editor;
}

describe("host project thumbnails", () => {
  afterEach(() => {
    cancelScheduledFrameThumbnails();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces rapid saves and renders the latest editor after the trailing delay", async () => {
    vi.useFakeTimers();
    const firstEditor = makeEditor("frame:first");
    const latestEditor = makeEditor("frame:latest");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const firstStored = vi.fn();
    const latestStored = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scheduleFrameThumbnail(firstEditor, projectId, 1_200, firstStored);
    await vi.advanceTimersByTimeAsync(800);
    scheduleFrameThumbnail(latestEditor, projectId, 1_200, latestStored);
    await vi.advanceTimersByTimeAsync(1_199);

    expect(firstEditor.toImage).not.toHaveBeenCalled();
    expect(latestEditor.toImage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(firstEditor.toImage).not.toHaveBeenCalled();
    expect(latestEditor.toImage).toHaveBeenCalledOnce();
    expect(latestEditor.toImage).toHaveBeenCalledWith(["frame:latest"], {
      format: "png",
      pixelRatio: 1,
      background: true,
      padding: 0
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(firstStored).not.toHaveBeenCalled();
    expect(latestStored).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`/api/projects/${projectId}/thumbnail`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "image/png" },
      body: expect.any(Blob)
    });
  });

  it("skips host writes when the page has no frame", async () => {
    const editor = {
      getCurrentPageShapes: vi.fn(() => []),
      toImage: vi.fn()
    } as unknown as Editor;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(storeFrameThumbnail(editor, projectId)).resolves.toBe(false);
    expect(editor.toImage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not refresh Recents when an in-flight thumbnail is cancelled", async () => {
    vi.useFakeTimers();
    const editor = makeEditor("frame:cancelled");
    let resolveResponse: ((response: { ok: boolean }) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveResponse = resolve;
        })
    );
    const onStored = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scheduleFrameThumbnail(editor, projectId, 0, onStored);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();

    cancelFrameThumbnail(projectId);
    resolveResponse?.({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(onStored).not.toHaveBeenCalled();
  });
});
