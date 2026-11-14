"use client";

import { ArrowUp, Stop, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { LunaThread } from "@/components/student/guide/LunaThread";
import { LUNA_COLORS } from "@/components/student/guide/moods";
import { IconButton } from "@/components/ui/button";
import { MAX_INPUT_CHARS } from "@/lib/ai/tools";
import { cn } from "@/lib/cn";
import { AiBadge, ChatError } from "./chat-ui";
import { useAssistant } from "./use-assistant";

const SUGGESTIONS = [
  "Where should I land?",
  "Why are craters so cold?",
  "Why does Earth wobble?",
  "What happens at night?",
];

/**
 * Student mode: "Ask LUNA" (Claude, playful tone for ~12-year-olds). Self-contained container meant for
 * LUNA's speech bubble; `compact` shortens the thread.
 */
export function GuideChat({ compact = false }: { compact?: boolean }) {
  const { messages, stoppedIds, busy, error, send, retry, stop, clear } = useAssistant("student");
  const [draft, setDraft] = useState("");

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    send(text);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm" style={{ color: LUNA_COLORS.lilac }}>
          Ask LUNA
        </span>
        <span className="flex items-center gap-1">
          {messages.length > 0 && (
            <IconButton label="Start over" size="sm" onClick={clear} disabled={busy}>
              <Trash size={14} weight="regular" />
            </IconButton>
          )}
          <AiBadge />
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="flex min-h-0 shrink flex-wrap gap-1.5 overflow-y-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => submit(s)}
              className={cn(
                "rounded-full px-3 py-1.5 text-left text-fg text-xs ring-1 ring-[oklch(0.78_0.12_300/0.35)]",
                "bg-[oklch(0.78_0.12_300/0.12)] transition-[transform,background-color] duration-150 ease-(--ease-out)",
                "hover:bg-[oklch(0.78_0.12_300/0.22)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <LunaThread
          messages={messages}
          stoppedIds={stoppedIds}
          busy={busy}
          className={cn("min-h-0 shrink", compact ? "max-h-64" : "max-h-80", "pr-1")}
        />
      )}

      {error && <ChatError error={error} onRetry={retry} />}

      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <input
          type="text"
          aria-label="Ask LUNA a question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          placeholder="Ask LUNA anything about the Moon"
          className={cn(
            "h-10 min-w-0 flex-1 rounded-full bg-white/6 px-4 text-fg text-sm ring-1 ring-line",
            "outline-none transition-[box-shadow] duration-150 placeholder:text-fg-faint focus:ring-line-strong",
          )}
        />
        {busy ? (
          <IconButton
            label="Stop answer"
            variant="secondary"
            size="lg"
            type="button"
            onClick={stop}
            className="size-10"
          >
            <Stop size={14} weight="fill" />
          </IconButton>
        ) : (
          <IconButton
            label="Send question"
            variant="primary"
            size="lg"
            type="submit"
            disabled={!draft.trim()}
            className="size-10"
          >
            <ArrowUp size={16} weight="regular" />
          </IconButton>
        )}
      </form>
      <p className="text-2xs text-fg-faint">LUNA's answers are written by AI from this app's calculations.</p>
    </div>
  );
}
