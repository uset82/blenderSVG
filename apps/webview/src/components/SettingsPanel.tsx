import type { AvatarConfig } from "../bridge/messages";
import { postToExtension } from "../bridge/vscodeApi";

type SettingsPanelProps = {
  config: AvatarConfig;
};

export function SettingsPanel({ config }: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="Avatar settings">
      <label className="setting-row checkbox-row">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) =>
            postToExtension({ type: "settings:update", config: { enabled: event.currentTarget.checked } })
          }
        />
      </label>
      <label className="setting-row">
        <span>Avatar</span>
        <input
          type="text"
          value={config.character}
          spellCheck={false}
          onChange={(event) =>
            postToExtension({ type: "settings:update", config: { character: event.currentTarget.value } })
          }
        />
      </label>
      <label className="setting-row">
        <span>Runtime</span>
        <select
          value={config.runtime}
          onChange={(event) =>
            postToExtension({
              type: "settings:update",
              config: { runtime: event.currentTarget.value as AvatarConfig["runtime"] }
            })
          }
        >
          <option value="svg">SVG</option>
          <option value="rive">Rive</option>
          <option value="webgl">WebGL</option>
          <option value="webgpu">WebGPU</option>
          <option value="live2d">Live2D</option>
        </select>
      </label>
      <label className="setting-row">
        <span>Position</span>
        <select
          value={config.position}
          onChange={(event) =>
            postToExtension({
              type: "settings:update",
              config: { position: event.currentTarget.value as AvatarConfig["position"] }
            })
          }
        >
          <option value="activity-bar-view">Activity</option>
          <option value="side-panel">Side</option>
          <option value="bottom-right">Right</option>
          <option value="bottom-left">Left</option>
        </select>
      </label>
      <label className="setting-row">
        <span>Intensity</span>
        <select
          value={config.animationIntensity}
          onChange={(event) =>
            postToExtension({
              type: "settings:update",
              config: { animationIntensity: event.currentTarget.value as AvatarConfig["animationIntensity"] }
            })
          }
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="setting-row checkbox-row">
        <span>Focus mode</span>
        <input
          type="checkbox"
          checked={config.focusMode}
          onChange={(event) =>
            postToExtension({ type: "settings:update", config: { focusMode: event.currentTarget.checked } })
          }
        />
      </label>
      <label className="setting-row checkbox-row">
        <span>Speech bubble</span>
        <input
          type="checkbox"
          checked={config.showSpeechBubble}
          onChange={(event) =>
            postToExtension({ type: "settings:update", config: { showSpeechBubble: event.currentTarget.checked } })
          }
        />
      </label>
      <label className="setting-row checkbox-row">
        <span>Reduced motion</span>
        <input
          type="checkbox"
          checked={config.respectReducedMotion}
          onChange={(event) =>
            postToExtension({ type: "settings:update", config: { respectReducedMotion: event.currentTarget.checked } })
          }
        />
      </label>
      <div className="settings-actions">
        <button type="button" onClick={() => postToExtension({ type: "command:resetSettings" })}>
          Reset
        </button>
      </div>
    </section>
  );
}
