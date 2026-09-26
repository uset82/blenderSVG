import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { ArrowUpDown, Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioModelCatalog } from "../bridge/studioHost.js";
import { isDuplicateRoute, MODEL_SORT_OPTIONS, type ModelSortOrder, sortStudioModels } from "./modelFilters.js";
import {
  FAVORITE_MODELS_KEY,
  filterModelsByBadges,
  formatContextLength,
  formatShortCatalogPrice,
  groupCatalogModels,
  isFreeModel,
  modelBadges,
  type QuickModelFilter,
  readStoredIds,
  RECENT_MODELS_KEY,
  recordRecentModel,
  safeDomId
} from "./modelPicker.js";
import { nextModelOptionIndex } from "./modelPickerNavigation.js";

export interface HomeModelPickerProps {
  catalog: StudioModelCatalog;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

/** Home's read of the shared OpenRouter catalog. Picking here records the choice
 *  in the same storage key the editor reads, so the editor opens with the chosen
 *  model already active. Home never initiates chat requests directly. */
export function HomeModelPicker({ catalog, selectedModelId, onSelectModel }: HomeModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickFilters, setQuickFilters] = useState<QuickModelFilter[]>([]);
  const [sortOrder, setSortOrder] = useState<ModelSortOrder>("most-popular");
  const [minimumContext, setMinimumContext] = useState<string>("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter out non-chat models and duplicate routes (~aliases and :batch variants)
  const models = useMemo(
    () => catalog.models.filter((model) => model.textChatEligible && !isDuplicateRoute(model)),
    [catalog.models]
  );
  const selectedModel = catalog.models.find((model) => model.id === selectedModelId);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const filteredModels = useMemo(() => {
    let result = models;
    const needle = query.trim().toLowerCase();
    if (needle) {
      result = result.filter(
        (model) =>
          model.name.toLowerCase().includes(needle) ||
          model.id.toLowerCase().includes(needle) ||
          model.author.toLowerCase().includes(needle)
      );
    }
    if (quickFilters.length > 0) {
      result = filterModelsByBadges(result, quickFilters);
    }
    if (minimumContext !== "all") {
      const minVal = Number(minimumContext);
      if (Number.isFinite(minVal)) {
        result = result.filter((model) => model.contextLength >= minVal);
      }
    }
    return sortStudioModels(result, sortOrder);
  }, [models, query, quickFilters, minimumContext, sortOrder]);

  const grouped = useMemo(() => {
    return groupCatalogModels(
      filteredModels,
      readStoredIds(FAVORITE_MODELS_KEY),
      readStoredIds(RECENT_MODELS_KEY),
      sortOrder
    );
  }, [filteredModels, sortOrder]);

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseModel = (modelId: string) => {
    onSelectModel(modelId);
    recordRecentModel(modelId);
    close(true);
  };

  const toggleQuickFilter = (filter: QuickModelFilter) => {
    setQuickFilters((current) => {
      const active = current.includes(filter);
      const next = active ? current.filter((item) => item !== filter) : [...current, filter];
      // When activating Intelligence, automatically order by intelligence high to low
      if (!active && filter === "intelligence" && sortOrder === "most-popular") {
        setSortOrder("intelligence-high-to-low");
      }
      return next;
    });
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
              <span>
                {filteredModels.length === models.length
                  ? `${models.length.toLocaleString()} available in this catalog`
                  : `${filteredModels.length.toLocaleString()} of ${models.length.toLocaleString()} shown`}
              </span>
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
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  listRef.current?.querySelector<HTMLButtonElement>('button[role="option"]:not(:disabled)')?.focus();
                }
              }}
            />
          </label>

          <div className="studio-model-picker-popover__subbar">
            <fieldset className="studio-model-picker-popover__quick-filters">
              <legend className="sr-only">Quick filters</legend>
              {(
                [
                  ["free", "Free"],
                  ["intelligence", "Intelligence"],
                  ["vision", "Vision"],
                  ["tools", "Tools"],
                  ["reasoning", "Reasoning"]
                ] as const
              ).map(([filter, label]) => {
                const active = quickFilters.includes(filter);
                return (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={active}
                    className={active ? "is-active" : ""}
                    onClick={() => toggleQuickFilter(filter)}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={minimumContext === "128000"}
                className={minimumContext === "128000" ? "is-active" : ""}
                onClick={() => setMinimumContext((cur) => (cur === "128000" ? "all" : "128000"))}
              >
                128K+
              </button>
            </fieldset>

            <label className="studio-model-picker-popover__sort-label">
              <ArrowUpDown size={12} aria-hidden="true" />
              <select
                aria-label="Sort models"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as ModelSortOrder)}
                className="studio-model-picker-popover__sort-select"
              >
                {MODEL_SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            ref={listRef}
            className="studio-model-picker-popover__list"
            role="listbox"
            aria-label="Available models"
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              const options = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)')
              ];
              if (options.length === 0) return;
              event.preventDefault();
              const active = document.activeElement as HTMLElement | null;
              const activeOption = active?.dataset.modelId ? active : active?.closest<HTMLElement>("[data-model-id]");
              const activeId = activeOption?.dataset.modelId;
              const current = activeId ? options.findIndex((opt) => opt.dataset.modelId === activeId) : -1;
              const next = nextModelOptionIndex(
                event.key as "ArrowDown" | "ArrowUp" | "Home" | "End",
                current,
                options.length
              );
              if (next !== null) options[next]?.focus();
            }}
          >
            {filteredModels.length === 0 && (
              <div className="studio-model-picker-popover__empty" role="status">
                <p>{query.trim() ? `No models match “${query.trim()}”.` : "No models match the selected filters."}</p>
                {(query.trim() || quickFilters.length > 0 || minimumContext !== "all") && (
                  <button
                    type="button"
                    className="studio-model-picker-popover__clear-button"
                    onClick={() => {
                      setQuery("");
                      setQuickFilters([]);
                      setMinimumContext("all");
                      setSortOrder("most-popular");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            {grouped.map((group) => (
              <div key={group.id} className="studio-model-picker-popover__group" role="group" aria-label={group.label}>
                <h3>{group.label}</h3>
                {group.models.map((model) => (
                  <div key={`${group.id}:${model.id}`} className="studio-model-picker-popover__row" role="presentation">
                    <button
                      id={`studio-home-model-option-${safeDomId(model.id)}`}
                      type="button"
                      role="option"
                      data-model-id={model.id}
                      aria-selected={model.id === selectedModelId}
                      disabled={!model.textChatEligible}
                      onClick={() => chooseModel(model.id)}
                    >
                      <span className="studio-model-picker-popover__model-copy">
                        <span className="studio-model-picker-popover__model-name">{model.name}</span>
                        <span className="studio-model-picker-popover__model-meta">
                          <span>
                            {model.author || "Other"} · {formatContextLength(model.contextLength)}
                          </span>
                          {typeof model.intelligence === "number" && (
                            <span className="studio-model-picker-popover__badge studio-model-picker-popover__badge--intelligence">
                              Intelligence: {model.intelligence.toFixed(1)}
                            </span>
                          )}
                          {isFreeModel(model) && <span className="studio-model-picker-popover__badge">Free</span>}
                          {modelBadges(model)
                            .filter((badge) => badge !== "Free" && badge !== "Intelligence")
                            .map((badge) => (
                              <span key={badge} className="studio-model-picker-popover__badge">
                                {badge}
                              </span>
                            ))}
                        </span>
                      </span>
                      <span className="studio-model-picker-popover__price">{formatShortCatalogPrice(model)}</span>
                      {model.id === selectedModelId && (
                        <Check className="studio-model-picker-popover__selected" size={15} aria-hidden="true" />
                      )}
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
