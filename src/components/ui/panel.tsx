import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Floating translucent HUD surface. Use only over the 3D canvas. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("glass rounded-xl", className)} {...props} />;
}

export function PanelHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-4 pt-3.5 pb-2", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
        <h2 className="truncate font-medium text-fg text-sm">{title}</h2>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-line border-t", className)} />;
}

type Tone = "sun" | "earth" | "night" | "danger" | "ok" | "neutral";

const toneText: Record<Tone, string> = {
  sun: "text-sun",
  earth: "text-earth",
  night: "text-[oklch(0.7_0.05_270)]",
  danger: "text-danger",
  ok: "text-ok",
  neutral: "text-fg",
};

const toneBg: Record<Tone, string> = {
  sun: "bg-sun-soft text-sun",
  earth: "bg-earth-soft text-earth",
  night: "bg-night-soft text-[oklch(0.78_0.05_270)]",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
  neutral: "bg-white/6 text-fg-muted",
};

/** Labelled numeric readout. Value is set in the mono face so digits never jitter. */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  size = "md",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow truncate">{label}</div>
      <div
        className={cn(
          "tabular mt-0.5 flex items-baseline gap-1 truncate",
          toneText[tone],
          size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm",
        )}
      >
        <span>{value}</span>
        {unit && <span className="text-fg-faint text-xs">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 truncate text-2xs text-fg-faint">{hint}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 font-medium text-2xs tracking-wide",
        toneBg[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-white/6 px-1 text-2xs text-fg-muted ring-1 ring-line",
        className,
      )}
      {...props}
    />
  );
}
