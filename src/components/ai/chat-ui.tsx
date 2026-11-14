"use client";

import { ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

/** AI disclosure badge (Space Apps rule: AI-generated content must be labelled). */
export function AiBadge() {
  return (
    <Tooltip content="Answers are written by Claude (AI) from this app's own calculations">
      <Badge tabIndex={0}>
        AI
        <span className="sr-only">
          {" "}
          — answers are written by Claude from this app's own calculations
        </span>
      </Badge>
    </Tooltip>
  );
}

export function ChatError({
  error,
  onRetry,
  className,
}: {
  error: Error;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger text-xs",
        className,
      )}
    >
      <WarningCircle
        size={15}
        weight="regular"
        className="mt-px shrink-0"
        aria-hidden
      />
      <p className="min-w-0 flex-1 break-words">
        {error.message || "Something went wrong."}
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRetry}
        className="-my-1 h-6 text-danger hover:text-danger"
      >
        <ArrowCounterClockwise size={13} weight="regular" aria-hidden />
        Retry
      </Button>
    </div>
  );
}

export function ExamplePrompts({
  prompts,
  onPick,
  disabled,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onPick(p)}
          className={cn(
            "rounded-md bg-white/4 px-2.5 py-1.5 text-left text-fg-muted text-xs ring-1 ring-line",
            "transition-[transform,background-color,color] duration-150 ease-(--ease-out) active:scale-[0.97]",
            "hover:bg-white/7 hover:text-fg disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
