import React from "react";
import { ArrowUp, Plus } from "lucide-react";

export const HOME_CATEGORY_PRESETS = [
  { id: "landing-page", label: "Landing page", width: 1440, height: 1024, starterPrompt: "Design a landing page for " },
  { id: "mobile-app", label: "Mobile app", width: 390, height: 844, starterPrompt: "Design a mobile app for " },
  { id: "web-app", label: "Web app", width: 1440, height: 900, starterPrompt: "Design a web app for " },
  { id: "dashboard", label: "Dashboard", width: 1440, height: 900, starterPrompt: "Design a dashboard for " },
  { id: "slides", label: "Slides", width: 1280, height: 720, starterPrompt: "Design a presentation about " },
  { id: "avatar", label: "Avatar", width: 800, height: 800, starterPrompt: "Design an avatar for " },
  { id: "icon-vector", label: "Icon / vector", width: 512, height: 512, starterPrompt: "Design a vector icon for " },
  { id: "other", label: "Something else", width: 1080, height: 720, starterPrompt: "Design " }
] as const;

export type HomeCategory = (typeof HOME_CATEGORY_PRESETS)[number];

export interface StudioComposerProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit?: (() => void) | undefined;
  submitEnabled?: boolean;
  submitHelp?: string;
  categories?: readonly HomeCategory[];
  categoryId?: HomeCategory["id"];
  onCategoryChange?: (category: HomeCategory) => void;
  contextControl?: React.ReactNode;
  modeControl?: React.ReactNode;
  variantControl?: React.ReactNode;
  modelControl?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}

/** Shared prompt surface for Home and the future editor agent panel. It never sends by itself. */
export function StudioComposer({
  prompt,
  onPromptChange,
  onSubmit,
  submitEnabled = true,
  submitHelp,
  categories,
  categoryId,
  onCategoryChange,
  contextControl,
  modeControl,
  variantControl,
  modelControl,
  footnote,
  className
}: StudioComposerProps) {
  const canSubmit = Boolean(onSubmit && submitEnabled && prompt.trim());
  const submit = () => {
    if (canSubmit) onSubmit?.();
  };

  return (
    <div className={`studio-composer${className ? ` ${className}` : ""}`}>
      {categories && categories.length > 0 && (
        <div className="studio-composer__categories" role="group" aria-label="What are you making?">
          {categories.map((category) => (
            <button
              className="studio-composer__category"
              key={category.id}
              type="button"
              aria-pressed={category.id === categoryId}
              onClick={() => onCategoryChange?.(category)}
              disabled={!onCategoryChange}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="studio-composer__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="studio-design-prompt">
          Describe what to design
        </label>
        <textarea
          id="studio-design-prompt"
          rows={3}
          maxLength={12_000}
          placeholder="Design anything…"
          value={prompt}
          onChange={(event) => onPromptChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSubmit) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="studio-composer__controls">
          {contextControl ?? (
            <button
              className="studio-composer__control studio-composer__add"
              type="button"
              disabled
              title="Add context after the file opens in the editor."
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Add context</span>
            </button>
          )}
          {modeControl ?? (
            <button
              className="studio-composer__control"
              type="button"
              disabled
              title="Home starts a Build frame. Change Ask, Plan, or Auto in the editor."
            >
              Build
            </button>
          )}
          {variantControl ?? (
            <button
              className="studio-composer__control studio-composer__variants"
              type="button"
              disabled
              title="Variants stay off until the agent harness can run them."
            >
              1×
            </button>
          )}
          {modelControl ?? <span className="studio-composer__model">Choose a model in the editor</span>}
          <button
            className="studio-composer__submit"
            type="submit"
            aria-label="Open design in editor"
            disabled={!canSubmit}
            title={submitHelp}
          >
            <ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </form>
      {footnote && <div className="studio-composer__footnote">{footnote}</div>}
      {submitHelp && !onSubmit && !footnote && <p className="studio-composer__help">{submitHelp}</p>}
    </div>
  );
}
