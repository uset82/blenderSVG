/**
 * Size limits for agent turns. A real landing page is 15–60 KB of HTML, so design tools need far more
 * room than the original 16 KB caps. `packages/avatar-core/src/studioProtocol.ts` repeats the protocol
 * literals (it does not depend on this package); a test keeps them equal.
 */

/** Largest JSON arguments string for one tool call. */
export const MAX_TOOL_ARGUMENT_CHARS = 262_144;
/** Largest HTML document a design frame stores. */
export const MAX_DESIGN_HTML_CHARS = 200_000;
/** Default cap for a tool result sent back to the model. */
export const MAX_TOOL_RESULT_CHARS = 16_000;
/** Cap for a tool result that carries a whole design document (get_design_frame). */
export const MAX_DESIGN_RESULT_CHARS = 220_000;
/** Largest single SSE event or buffered line from the provider. */
export const MAX_SSE_EVENT_CHARS = 1_000_000;
/** Default width of a new design frame (desktop). */
export const DEFAULT_DESIGN_WIDTH = 1_440;
/** Gap between design frames placed next to each other. */
export const DESIGN_FRAME_GAP = 160;
