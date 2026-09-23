import { Check, ChevronDown, Search } from "lucide-react";
import { Popover as RadixPopover, ToggleGroup } from "radix-ui";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { cx, studioPortalContainer } from "./shared.js";

export type SegmentedOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SegmentedProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegmentedOption[];
  className?: string;
};

export function Segmented({ label, value, onValueChange, options, className }: SegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      aria-label={label}
      className={cx("studio-ui-segmented", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="studio-ui-segmented__item"
          aria-label={option.label}
        >
          {option.icon && <span aria-hidden="true">{option.icon}</span>}
          <span>{option.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  label: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choose an option",
  searchPlaceholder = "Search",
  emptyLabel = "No matches",
  disabled,
  className
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search
      ? options.filter((option) =>
          `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`.toLocaleLowerCase().includes(search)
        )
      : options;
  }, [options, query]);
  const selected = options.find((option) => option.value === value);
  const active = filtered[activeIndex];

  const select = (option: ComboboxOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const move = (direction: 1 | -1) => {
    if (!filtered.length) return;
    let next = activeIndex;
    for (let attempt = 0; attempt < filtered.length; attempt += 1) {
      next = (next + direction + filtered.length) % filtered.length;
      if (!filtered[next]?.disabled) {
        setActiveIndex(next);
        break;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter" && active && !active.disabled) {
      event.preventDefault();
      select(active);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(
        Math.max(
          0,
          filtered.findIndex((option) => !option.disabled)
        )
      );
    } else if (event.key === "End") {
      event.preventDefault();
      let last = -1;
      filtered.forEach((option, index) => {
        if (!option.disabled) last = index;
      });
      setActiveIndex(Math.max(0, last));
    }
  };

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActiveIndex(
            Math.max(
              0,
              options.findIndex((option) => option.value === value && !option.disabled)
            )
          );
        }
      }}
    >
      <RadixPopover.Trigger asChild disabled={disabled}>
        <button type="button" aria-label={label} className={cx("studio-ui-combobox__trigger", className)}>
          <span className={cx(!selected && "studio-ui-combobox__placeholder")}>{selected?.label ?? placeholder}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal container={studioPortalContainer()}>
        <RadixPopover.Content
          className="studio-ui-combobox__content"
          sideOffset={6}
          align="start"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <label className="studio-ui-combobox__search">
            <Search size={15} aria-hidden="true" />
            <span className="studio-ui-sr-only">Search {label.toLocaleLowerCase()}</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-label={`Search ${label.toLocaleLowerCase()}`}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={active && !active.disabled ? `${listId}-${activeIndex}` : undefined}
              placeholder={searchPlaceholder}
            />
          </label>
          <div id={listId} role="listbox" aria-label={label} className="studio-ui-combobox__list">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listId}-${index}`}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === activeIndex}
                  className="studio-ui-combobox__option"
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => select(option)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select(option);
                    }
                  }}
                >
                  <span className="studio-ui-combobox__option-text">
                    <span>{option.label}</span>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {option.value === value && <Check size={15} aria-hidden="true" />}
                </button>
              ))
            ) : (
              <p className="studio-ui-combobox__empty">{emptyLabel}</p>
            )}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export type ResizeHandleProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onResize: (value: number) => void;
  orientation?: "vertical" | "horizontal";
  step?: number;
  reverse?: boolean;
  controls?: string;
  className?: string;
};

export function ResizeHandle({
  label,
  value,
  min,
  max,
  onResize,
  orientation = "vertical",
  step = 8,
  reverse = false,
  controls,
  className
}: ResizeHandleProps) {
  const start = useRef<{ position: number; value: number } | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const sign = reverse ? -1 : 1;
  const coordinate = (event: PointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions = orientation === "vertical" ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
    const direction = directions[event.key as keyof typeof directions];
    if (direction) {
      event.preventDefault();
      onResize(clamp(value + direction * step * sign));
    } else if (event.key === "Home") {
      event.preventDefault();
      onResize(min);
    } else if (event.key === "End") {
      event.preventDefault();
      onResize(max);
    }
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a splitter exposes aria-valuenow, which hr does not
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx("studio-ui-resize-handle", `studio-ui-resize-handle--${orientation}`, className)}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = { position: coordinate(event), value };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        onResize(clamp(start.current.value + (coordinate(event) - start.current.position) * sign));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <span aria-hidden="true" />
    </div>
  );
}
