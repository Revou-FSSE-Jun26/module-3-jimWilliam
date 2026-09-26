import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "@/lib/classes";

interface CardProps {
  as?: ElementType;
  children: ReactNode;
  /** light the border up on hover */
  interactive?: boolean;
  /** tint for the hover glow; defaults to cyan */
  accent?: string;
  className?: string;
  style?: CSSProperties;
  href?: string;
  [key: `data-${string}`]: string | undefined;
}

/**
 * The wrapper every tile in the store sits in - product cards, stat tiles, dashboard panels.
 * One place for the surface colour, border, radius and hover glow.
 */
export default function Card({ as: Tag = "div", children, interactive = false, accent, className, style, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      style={{ ...(accent && ({ "--card-accent": accent } as CSSProperties)), ...style }}
      className={cx(
        "panel relative overflow-hidden",
        interactive &&
          "transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--card-accent,var(--color-cyan))_60%,transparent)] hover:shadow-[0_18px_50px_-18px_var(--card-accent,var(--color-cyan))]",
        className
      )}
    >
      {children}
    </Tag>
  );
}
