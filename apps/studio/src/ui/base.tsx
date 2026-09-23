import { X } from "lucide-react";
import { Tooltip } from "radix-ui";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx, studioPortalContainer } from "./shared.js";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "compact" | "default" | "large";
  loading?: boolean;
};

export function Button({
  children,
  className,
  variant = "secondary",
  size = "default",
  loading = false,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx("studio-ui-button", `studio-ui-button--${variant}`, `studio-ui-button--${size}`, className)}
    >
      {loading && <span className="studio-ui-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
};

export function IconButton({ icon, label, shortcut, tooltipSide = "top", className, ...props }: IconButtonProps) {
  return (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button {...props} aria-label={label} className={cx("studio-ui-icon-button", className)}>
            <span aria-hidden="true">{icon}</span>
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Portal container={studioPortalContainer()}>
          <Tooltip.Content className="studio-ui-tooltip" side={tooltipSide} sideOffset={7}>
            <span>{label}</span>
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function FloatingPill({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("studio-ui-floating-pill", className)}>
      {children}
    </div>
  );
}

export type ChipProps = {
  label: ReactNode;
  detail?: ReactNode;
  pressed?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function Chip({ label, detail, pressed, onClick, onRemove, removeLabel, disabled, className }: ChipProps) {
  const content = (
    <>
      {label}
      {detail && <span className="studio-ui-chip__detail">{detail}</span>}
    </>
  );
  return (
    <span className={cx("studio-ui-chip", pressed && "studio-ui-chip--pressed", className)}>
      {onClick ? (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={pressed}
          onClick={onClick}
          className="studio-ui-chip__action"
        >
          {content}
        </button>
      ) : (
        <span className="studio-ui-chip__content">{content}</span>
      )}
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="studio-ui-chip__remove"
          aria-label={removeLabel ?? `Remove ${typeof label === "string" ? label : "item"}`}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export function Kbd({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd {...props} className={cx("studio-ui-kbd", className)}>
      {children}
    </kbd>
  );
}

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("studio-ui-empty-state", className)}>
      {icon && (
        <span className="studio-ui-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="studio-ui-empty-state__title">{title}</h3>
      {description && <p className="studio-ui-empty-state__description">{description}</p>}
      {action && <div className="studio-ui-empty-state__action">{action}</div>}
    </div>
  );
}

export type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  width?: string | number;
  height?: string | number;
  radius?: "control" | "panel" | "pill";
};

export function Skeleton({ width, height, radius = "control", className, style, ...props }: SkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cx("studio-ui-skeleton", `studio-ui-skeleton--${radius}`, className)}
      style={{ ...style, width, height }}
    />
  );
}
