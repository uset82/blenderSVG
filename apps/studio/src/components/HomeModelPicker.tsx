import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioModelCatalog } from "../bridge/studioHost.js";

export interface HomeModelPickerProps {
  catalog: StudioModelCatalog;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

/** Home's read of the shared OpenRouter catalog. Picking here only records the
 *  choice in the same storage key the editor's agent panel reads, so the editor
 *  opens with the model already selected. Home still never sends a request. */
export function HomeModelPicker({ catalog, selectedModelId, onSelectModel }: HomeModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const models = useMemo(() => catalog.models.filter((model) => model.textChatEligible), [catalog.models]);
  const selectedModel = models.find((model) => model.id === selectedModelId);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? models.filter(
          (model) =>
            model.name.toLowerCase().includes(needle) ||
            model.id.toLowerCase().includes(needle) ||
            model.author.toLowerCase().includes(needle)
        )
      : models;
    const map = new Map<string, StudioModel[]>();
    for (const model of matches) {
      const author = model.author || "Other";
      const bucket = map.get(author);
      if (bucket) bucket.push(model);
      else map.set(author, [model]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [models, query]);

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  // Nothing connected yet: keep the original signpost so Home never looks broken.
  if (catalog.status !== "ready" || models.length === 0) {
    const label =
      catalog.status === "loading"
        ? "Loading models…"
        : catalog.status === "error"
          ? "Models unavailable"
          : "Choose a model in the editor";
    return (
      <button
        className="studio-composer__control studio-composer__model-button"
        type="button"
        disabled
        title={catalog.status === "idle" ? "Connect OpenRouter in Settings to load models." : catalog.message || label}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="studio-composer__model-wrap" ref={containerRef}>
      <button
        ref={triggerRef}
        className="studio-composer__control studio-composer__model-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="studio-home-model-picker"
        title={selectedModel ? `${selectedModel.name} · change model` : "Choose an OpenRouter model"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="studio-model-picker-trigger__name">{selectedModel?.name ?? "Choose model"}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open && (
        <section
          id="studio-home-model-picker"
          className="studio-model-picker-popover studio-home-model-picker"
          role="dialog"
          aria-label="Choose an OpenRouter model"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close(true);
            }
          }}
        >
          <header className="studio-model-picker-popover__header">
            <div>
              <strong>Choose a model</strong>
              <span>{models.length.toLocaleString()} available in this catalog</span>
            </div>
            <button
              className="studio-model-picker-popover__icon-button"
              type="button"
              aria-label="Close model picker"
              onClick={() => close(true)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          <label className="studio-model-picker-popover__search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models or publishers"
              aria-label="Search models"
            />
          </label>

          <div className="studio-model-picker-popover__list" role="listbox" aria-label="Available models">
            {grouped.length === 0 && (
              <p className="studio-model-picker-popover__catalog-note">No models match “{query}”.</p>
            )}
            {grouped.map(([author, group]) => (
              <div key={author} className="studio-model-picker-popover__group">
                <h3>{author}</h3>
                {group.map((model) => (
                  <div key={model.id} className="studio-model-picker-popover__row">
                    <button
                      type="button"
                      role="option"
                      aria-selected={model.id === selectedModelId}
                      onClick={() => {
                        onSelectModel(model.id);
                        close(true);
                      }}
                    >
                      <span className="studio-model-picker-popover__model-copy">
                        <span className="studio-model-picker-popover__model-name">{model.name}</span>
                        <span className="studio-model-picker-popover__model-meta">{model.id}</span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
