import type React from "react";

export interface BrandMarkProps {
  className?: string | undefined;
  title?: string | undefined;
}

/** Kurva mark: ink stem + vermilion curve. Stem follows `currentColor`. */
export const BrandMark = ({ className, title = "Kurva" }: BrandMarkProps): React.JSX.Element => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    role="img"
    aria-label={title}
    focusable="false"
  >
    <title>{title}</title>
    <line
      x1="18"
      y1="10"
      x2="18"
      y2="54"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path
      d="M48 10 C16 28 16 36 48 54"
      fill="none"
      stroke="var(--k-vermilion, #D2461E)"
      strokeWidth="8"
      strokeLinecap="round"
    />
  </svg>
);
