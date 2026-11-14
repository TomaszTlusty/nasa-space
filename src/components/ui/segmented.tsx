"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** accessible label when `label` is an icon */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
  /** stretch segments to fill the width */
  block?: boolean;
}

/** Single-select pill group (mode switch, window length, layer choice). Always exactly one value. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
  className,
  block,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      value={[value]}
      onValueChange={(next) => {
        const v = next[0] as T | undefined;
        if (v && v !== value) onChange(v);
      }}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-black/30 p-0.5 ring-1 ring-line",
        block && "flex w-full",
        className,
      )}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          disabled={o.disabled}
          className={cn(
            "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium text-fg-muted",
            "transition-[background-color,color,box-shadow,transform] duration-150 ease-(--ease-out)",
            "hover:text-fg active:scale-[0.97] data-disabled:opacity-40",
            "data-pressed:bg-surface-3 data-pressed:text-fg data-pressed:shadow-[inset_0_1px_0_oklch(1_0_0/0.08),0_1px_3px_oklch(0_0_0/0.4)]",
            size === "sm" ? "h-6 px-2.5 text-2xs" : "h-8 px-3.5 text-xs",
            block && "flex-1",
          )}
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
