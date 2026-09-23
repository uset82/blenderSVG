import { BrainCircuit, Code2, MessageCircle, Moon, PartyPopper, TriangleAlert } from "lucide-react";
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from "tldraw";
import type { AvatarShape } from "./types.js";

const AVATAR_STATES = [
  { id: "idle", label: "Idle", icon: Moon },
  { id: "thinking", label: "Thinking", icon: BrainCircuit },
  { id: "speaking", label: "Speaking", icon: MessageCircle },
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "celebrate", label: "Celebrate", icon: PartyPopper },
  { id: "error", label: "Error", icon: TriangleAlert }
];

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
      speech: "Local illustration preview only. This does not animate a character rig."
    };
  }

  getGeometry(shape: AvatarShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    });
  }

  getIndicatorPath(shape: AvatarShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }

  component(shape: AvatarShape) {
    const { character, avatarState, speech } = shape.props;

    const handleStateChange = (newState: string) => {
      this.editor.updateShape<AvatarShape>({
        id: shape.id,
        type: "avatar",
        props: {
          avatarState: newState,
          speech: `State changed to ${newState}`
        }
      });
    };

    const figureClass =
      avatarState === "celebrate"
        ? "studio-shape__figure studio-shape__figure--celebrate"
        : avatarState === "thinking"
          ? "studio-shape__figure studio-shape__figure--thinking"
          : "studio-shape__figure";

    return (
      <HTMLContainer
        className="studio-shape studio-shape--avatar"
        style={{ width: shape.props.w, height: shape.props.h }}
      >
        <div className="studio-shape__row">
          <span className="studio-shape__title studio-shape__title--avatar">Avatar Stage</span>
          <span className="studio-shape__pill">Illustration preview</span>
        </div>

        <div className="studio-shape__speech">{speech}</div>

        <div className="studio-shape__stage">
          <div className={figureClass}>
            {character === "cholita-3d" ? (
              <svg viewBox="0 0 168 168" aria-hidden="true">
                <circle
                  cx="84"
                  cy="84"
                  r="70"
                  fill="var(--studio-surface-2)"
                  stroke="var(--studio-accent)"
                  strokeWidth="2"
                />
                <ellipse cx="84" cy="38" rx="28" ry="10" fill="var(--studio-canvas)" />
                <rect
                  x="68"
                  y="22"
                  width="32"
                  height="18"
                  rx="6"
                  fill="var(--studio-surface-0)"
                  stroke="var(--studio-divider)"
                />
                <circle cx="84" cy="74" r="32" fill="var(--studio-warning)" />
                <ellipse cx="73" cy="72" rx="4" ry={avatarState === "idle" ? "1" : "6"} fill="var(--studio-canvas)" />
                <ellipse cx="95" cy="72" rx="4" ry={avatarState === "idle" ? "1" : "6"} fill="var(--studio-canvas)" />
                <path
                  d={
                    avatarState === "speaking"
                      ? "M78 86 Q84 94 90 86 Z"
                      : avatarState === "error"
                        ? "M78 88 Q84 82 90 88"
                        : "M78 84 Q84 90 90 84"
                  }
                  fill={avatarState === "speaking" ? "var(--studio-danger)" : "none"}
                  stroke="var(--studio-canvas)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <ellipse cx="66" cy="80" rx="4" ry="2" fill="var(--studio-danger)" opacity="0.4" />
                <ellipse cx="102" cy="80" rx="4" ry="2" fill="var(--studio-danger)" opacity="0.4" />
                <path d="M52 106 L116 106 L124 150 L44 150 Z" fill="var(--studio-danger)" />
                <path d="M64 106 L84 126 L104 106 Z" fill="var(--studio-accent)" />
              </svg>
            ) : (
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" fill="var(--studio-success)" opacity="0.8" />
                <circle cx="40" cy="45" r="5" fill="var(--studio-text-primary)" />
                <circle cx="60" cy="45" r="5" fill="var(--studio-text-primary)" />
                <path d="M40 65 Q50 75 60 65" stroke="var(--studio-text-primary)" strokeWidth="3" fill="none" />
              </svg>
            )}
          </div>

          <div className="studio-shape__state">
            <span
              className={avatarState === "error" ? "studio-shape__dot studio-shape__dot--error" : "studio-shape__dot"}
            />
            {avatarState.toUpperCase()} · PREVIEW
          </div>
        </div>

        <div className="studio-shape__states">
          {AVATAR_STATES.map((st) => (
            <button
              type="button"
              key={st.id}
              className="studio-shape__state-button"
              aria-pressed={avatarState === st.id}
              onClick={() => handleStateChange(st.id)}
            >
              <st.icon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </HTMLContainer>
    );
  }
}
