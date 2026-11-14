"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-(--ease-out) " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 data-disabled:pointer-events-none data-disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "bg-sun text-[oklch(0.2_0.03_70)] shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_8px_24px_-8px_oklch(0.78_0.16_65/0.55)] hover:bg-sun-strong",
  secondary: "bg-surface-2 text-fg shadow-[inset_0_1px_0_var(--color-highlight)] ring-1 ring-line hover:bg-surface-3",
  ghost: "text-fg-muted hover:bg-white/5 hover:text-fg",
  danger: "bg-danger-soft text-danger ring-1 ring-danger/30 hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-7 rounded-sm px-2.5 text-xs",
  md: "h-9 rounded-md px-3.5 text-sm",
  lg: "h-11 rounded-full px-5 text-base",
};

export interface ButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return <BaseButton className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

const iconSizes: Record<Size, string> = {
  sm: "size-7 rounded-sm",
  md: "size-9 rounded-md",
  lg: "size-11 rounded-full",
};

export interface IconButtonProps extends ComponentProps<typeof BaseButton> {
  variant?: Variant;
  size?: Size;
  /** accessible label, required: icon buttons have no visible text */
  label: string;
}

export function IconButton({ variant = "ghost", size = "md", label, className, ...props }: IconButtonProps) {
  return (
    <BaseButton
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], iconSizes[size], "px-0", className)}
      {...props}
    />
  );
}
