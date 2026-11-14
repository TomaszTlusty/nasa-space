"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  /** formatted value shown at the right of the label row; omit to hide the row */
  valueLabel?: ReactNode;
  showLabel?: boolean;
  tone?: "sun" | "earth" | "neutral";
  className?: string;
  disabled?: boolean;
}

const tones = {
  sun: "bg-sun",
  earth: "bg-earth",
  neutral: "bg-fg-muted",
};

export function Slider({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  label,
  valueLabel,
  showLabel = true,
  tone = "sun",
  className,
  disabled,
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onChange(v as number)}
      onValueCommitted={onCommit ? (v) => onCommit(v as number) : undefined}
      className={cn("flex w-full flex-col gap-1.5", className)}
    >
      {showLabel && (
        <div className="flex items-baseline justify-between gap-3">
          <BaseSlider.Label className="text-xs text-fg-muted">{label}</BaseSlider.Label>
          {valueLabel !== undefined && <span className="tabular text-xs text-fg">{valueLabel}</span>}
        </div>
      )}
      <BaseSlider.Control className="flex h-5 w-full touch-none select-none items-center">
        <BaseSlider.Track className="relative h-1 w-full rounded-full bg-white/10">
          <BaseSlider.Indicator className={cn("rounded-full", tones[tone])} />
          <BaseSlider.Thumb
            aria-label={showLabel ? undefined : label}
            className={cn(
              "size-4 rounded-full bg-fg shadow-[0_0_0_4px_oklch(0_0_0/0.35),0_2px_6px_oklch(0_0_0/0.5)]",
              "transition-[transform] duration-150 ease-(--ease-out) data-dragging:scale-110",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sun",
            )}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
