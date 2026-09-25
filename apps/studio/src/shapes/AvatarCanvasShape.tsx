import { isAvatarState, type AvatarState } from "@codex-avatar-studio/avatar-core";
import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { BrainCircuit, Code2, MessageCircle, Moon, PartyPopper, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { HTMLContainer, Rectangle2d, ShapeUtil, T, type Editor } from "tldraw";
import { LayeredMascotRenderer } from "../../../webview/src/renderers/LayeredMascotRenderer.js";
import { SvgAvatarRenderer } from "../../../webview/src/renderers/SvgAvatarRenderer.js";
import { avatarPackageManifest, avatarPackageSvg } from "./avatarPackageDraft.js";
import { serializeAvatarSvgSnapshot } from "./avatarPackageSnapshot.js";
import type { AvatarShape } from "./types.js";

const AVATAR_STATES = [
  { id: "idle", label: "Idle", icon: Moon },
  { id: "thinking", label: "Thinking", icon: BrainCircuit },
  { id: "speaking", label: "Speaking", icon: MessageCircle },
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "celebrate", label: "Celebrate", icon: PartyPopper },
  { id: "error", label: "Error", icon: TriangleAlert }
] as const;

const PACKAGE_SVG_PREVIEW = prepareSvgPreview(avatarPackageSvg()).src;

export class AvatarShapeUtil extends ShapeUtil<AvatarShape> {
  static override type = "avatar" as const;
  static override props = {
    w: T.number,
    h: T.number,
    character: T.string,
    avatarState: T.string,
    speech: T.string
  };

  getDefaultProps(): AvatarShape["props"] {
    return {
      w: 340,
      h: 480,
      character: "cholita-3d",
      avatarState: "idle",
      speech: "A local illustration preview. Exported packages contain a static SVG pose."
    };
  }

  getGeometry(shape: AvatarShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  getIndicatorPath(shape: AvatarShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }

  component(shape: AvatarShape) {
    return (
      <HTMLContainer
        className="studio-shape studio-shape--avatar"
        style={{ width: shape.props.w, height: shape.props.h }}
      >
        <AvatarShapeContent shape={shape} editor={this.editor} />
      </HTMLContainer>
    );
  }
}

function AvatarShapeContent({ shape, editor }: { shape: AvatarShape; editor: Editor }) {
  const { character, avatarState, speech } = shape.props;
  const [packageStatus, setPackageStatus] = useState("");
  const mascot = character === "cholita-3d";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const previewState = mascotState(avatarState);

  const updateShape = (props: Partial<AvatarShape["props"]>) => {
    editor.updateShape<AvatarShape>({ id: shape.id, type: "avatar", props });
  };

  const savePackage = async (button: HTMLButtonElement) => {
    setPackageStatus("Preparing a sanitized static SVG package…");
    try {
      const visibleMascot = button.closest(".studio-shape--avatar")?.querySelector("svg.layered-mascot");
      const svg =
        mascot && visibleMascot instanceof SVGSVGElement
          ? serializeAvatarSvgSnapshot(visibleMascot)
          : avatarPackageSvg();
      const name = mascot ? "Cholita 3D" : "Kurva SVG Avatar";
      await downloadAvatarPackage(name, svg);
      setPackageStatus(`${name} package download started. The export is a static SVG pose.`);
    } catch (error) {
      setPackageStatus(error instanceof Error ? error.message : "The avatar package could not be saved.");
    }
  };

  return (
    <div className="studio-shape__avatar-content">
      <div className="studio-shape__row">
        <span className="studio-shape__title studio-shape__title--avatar">Avatar builder</span>
        <span className="studio-shape__pill">{mascot ? "Layered illustration" : "SVG package"}</span>
      </div>

      <div className="studio-shape__speech">{speech}</div>

      <div className="studio-shape__renderer-tabs" role="group" aria-label="Avatar renderer">
        <button type="button" aria-pressed={mascot} onClick={() => updateShape({ character: "cholita-3d" })}>
          Layered mascot
        </button>
        <button type="button" aria-pressed={!mascot} onClick={() => updateShape({ character: "package-svg" })}>
          Package SVG
        </button>
      </div>

      <div className="studio-shape__stage">
        <div
          className={`studio-shape__figure${avatarState === "celebrate" ? " studio-shape__figure--celebrate" : ""}${avatarState === "thinking" ? " studio-shape__figure--thinking" : ""}`}
        >
          {mascot ? (
            <LayeredMascotRenderer
              state={previewState}
              poseInput={{ cursorX: 0.5, cursorY: 0.5, mouthOpen: avatarState === "speaking" ? 0.6 : 0 }}
              reducedMotion={reducedMotion}
              intensity="low"
              focusMode={false}
              lipSyncEnabled={avatarState === "speaking"}
              triggerEvent={null}
            />
          ) : (
            <SvgAvatarRenderer
              state={previewState}
              poseInput={{ cursorX: 0.5, cursorY: 0.5, mouthOpen: avatarState === "speaking" ? 0.6 : 0 }}
              reducedMotion={reducedMotion}
              intensity="low"
              focusMode={false}
              lipSyncEnabled={avatarState === "speaking"}
              assetUri={PACKAGE_SVG_PREVIEW}
            />
          )}
        </div>
        <div className="studio-shape__state">
          <span
            className={avatarState === "error" ? "studio-shape__dot studio-shape__dot--error" : "studio-shape__dot"}
          />
          {avatarState.toUpperCase()} · PREVIEW
        </div>
      </div>

      <div className="studio-shape__states" role="group" aria-label="Avatar state preview">
        {AVATAR_STATES.map((state) => (
          <button
            type="button"
            key={state.id}
            className="studio-shape__state-button"
            aria-pressed={avatarState === state.id}
            onClick={() => updateShape({ avatarState: state.id, speech: `State changed to ${state.label}.` })}
          >
            <state.icon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{state.label}</span>
          </button>
        ))}
      </div>

      <p className="studio-shape__export-note">
        Package export captures a static SVG pose; preview state controls are not animated in the package.
      </p>
      <button
        type="button"
        className="studio-shape__package-button"
        onClick={(event) => void savePackage(event.currentTarget)}
      >
        Save as avatar package
      </button>
      {packageStatus && (
        <p className="studio-shape__package-status" role="status">
          {packageStatus}
        </p>
      )}
    </div>
  );
}

function mascotState(value: string): AvatarState {
  if (value === "celebrate") return "success";
  return isAvatarState(value) ? value : "idle";
}

async function downloadAvatarPackage(name: string, svg: string): Promise<void> {
  const safeSvg = prepareSvgPreview(svg).svg;
  const isStandaloneHost = (() => {
    try {
      return window.sessionStorage.getItem("kurva-studio-standalone") === "1";
    } catch {
      return false;
    }
  })();
  if (isStandaloneHost) {
    const response = await fetch("/api/avatar-package", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, svg: safeSvg })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message || "The avatar package could not be saved.");
    }
    if (!response.headers.get("content-type")?.includes("application/zip")) {
      throw new Error("The Studio host did not return a validated avatar package.");
    }
    const blob = await response.blob();
    const match = /filename="([^\"]+)"/.exec(response.headers.get("content-disposition") ?? "");
    saveDownload(blob, match?.[1] || "avatar.codex-avatar.zip");
    return;
  }
  const manifest = avatarPackageManifest(name);
  const payload = JSON.stringify({ manifest, svg: safeSvg }, null, 2);
  saveDownload(new Blob([payload], { type: "application/json" }), `${manifest.id}.avatar-package.json`);
}

function saveDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
