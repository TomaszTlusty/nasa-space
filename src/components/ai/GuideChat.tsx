"use client";

import { ArrowUp, Stop, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { MAX_INPUT_CHARS } from "@/lib/ai/tools";
import { cn } from "@/lib/cn";
import { ChatThread } from "./ChatThread";
import { AiBadge, ChatError, ExamplePrompts } from "./chat-ui";
import { useAssistant } from "./use-assistant";

const EXAMPLES = [
  "Why is it so dark inside craters?",
  "Show me a sunny place to land",
  "Why can't we always see Earth from the pole?",
];

/**
 * Student mode: ask LUNA-Bot (Claude, friendly tone for ~12-year-olds). Self-contained, unstyled
 * container — place it inside the guide panel. `compact` shortens the thread and examples.
 */
export function GuideChat({ compact = false }: { compact?: boolean }) {
  const { messages, busy, error, send, retry, stop, clear } =
    useAssistant("student");
  const [draft, setDraft] = useState("");

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    send(text);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Ask LUNA-Bot</span>
        <span className="flex items-center gap-1">
          {messages.length > 0 && (
            <IconButton
              label="Clear chat"
              size="sm"
              onClick={clear}
              disabled={busy}
            >
              <Trash size={14} weight="regular" />
            </IconButton>
          )}
          <AiBadge />
        </span>
      </div>

      {messages.length === 0 ? (
        <ExamplePrompts
          prompts={compact ? EXAMPLES.slice(0, 2) : EXAMPLES}
          onPick={submit}
          disabled={busy}
        />
      ) : (
        <ChatThread
          messages={messages}
          busy={busy}
          assistantName="LUNA-Bot"
          className={cn(compact ? "max-h-48" : "max-h-72", "pr-1")}
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
          aria-label="Ask LUNA-Bot a question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          placeholder="Ask LUNA-Bot a question"
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md bg-white/4 px-3 text-fg text-sm ring-1 ring-line",
            "outline-none transition-[box-shadow] duration-150 placeholder:text-fg-faint focus:ring-line-strong",
          )}
        />
        {busy ? (
          <IconButton
            label="Stop answer"
            variant="secondary"
            type="button"
            onClick={stop}
          >
            <Stop size={14} weight="fill" />
          </IconButton>
        ) : (
          <IconButton
            label="Send question"
            variant="primary"
            type="submit"
            disabled={!draft.trim()}
          >
            <ArrowUp size={15} weight="regular" />
          </IconButton>
        )}
      </form>
    </div>
  );
}
