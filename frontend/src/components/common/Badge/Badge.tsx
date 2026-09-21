import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral" | "info";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variantClass = styles[variant] || styles.default;
  return (
    <span className={`${styles.badge} ${variantClass} ${className || ""}`.trim()}>
      {children}
    </span>
  );
}
