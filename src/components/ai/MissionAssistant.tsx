"use client";

import { ArrowUp, Stop, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd, Panel, PanelHeader } from "@/components/ui/panel";
import { MAX_INPUT_CHARS } from "@/lib/ai/tools";
import { cn } from "@/lib/cn";
import { ChatThread } from "./ChatThread";
import { AiBadge, ChatError, ExamplePrompts } from "./chat-ui";
import { useAssistant } from "./use-assistant";

const EXAMPLES = [
  "Survive 10 days, need Earth contact half the time, landing early March 2027",
  "Find a flat spot with at least 70% sunlight in the current window",
  "What changes if launch slips by 7 days?",
];

/**
 * Science mode: describe a mission in words; Claude drives the app's real tools (window, discovery,
 * landers) and explains the results. Mount in the left column, top.
 */
export function MissionAssistant({ className }: { className?: string }) {
  const { messages, stoppedIds, busy, error, send, retry, stop, clear } = useAssistant("science");
  const [draft, setDraft] = useState("");
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    send(text);
    setDraft("");
  };

  return (
    <Panel className={cn("flex max-h-[min(72vh,680px)] flex-col overflow-hidden", className)}>
      <PanelHeader
        className="shrink-0"
        eyebrow="Mission assistant"
        title="Plan a mission in words"
        actions={
          <>
            {messages.length > 0 && (
              <IconButton label="Clear conversation" size="sm" onClick={clear} disabled={busy}>
                <Trash size={14} weight="regular" />
              </IconButton>
            )}
            <AiBadge />
          </>
        }
      />

      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pb-3">
          <p className="text-fg-muted text-xs leading-relaxed">
            Say what your lander needs. The assistant sets the dates, searches the terrain and places landers using this
            app's own calculations — watch the scene update.
          </p>
          <ExamplePrompts prompts={EXAMPLES} onPick={submit} disabled={busy} />
        </div>
      ) : (
        <ChatThread
          messages={messages}
          stoppedIds={stoppedIds}
          busy={busy}
          assistantName="Assistant"
          className="min-h-0 flex-1 px-4 pb-3"
        />
      )}

      {error && <ChatError error={error} onRetry={retry} className="mx-3 mb-2 shrink-0" />}

      <form
        className="shrink-0 border-line border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <label htmlFor="mission-assistant-input" className="sr-only">
          Describe your mission
        </label>
        <textarea
          id="mission-assistant-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit(draft);
            }
          }}
          maxLength={MAX_INPUT_CHARS}
          rows={3}
          placeholder='Describe your mission — e.g. "survive 10 days, need Earth contact half the time, landing early March 2027"'
          className={cn(
            "block w-full resize-none rounded-md bg-white/4 px-3 py-2 text-fg text-sm ring-1 ring-line",
            "outline-none transition-[box-shadow] duration-150 placeholder:text-fg-faint focus:ring-line-strong",
          )}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-2xs text-fg-faint">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>Enter</Kbd>
            <span className="ml-0.5">to send</span>
            {draft.length > MAX_INPUT_CHARS * 0.8 && (
              <span className="tabular ml-2">
                {draft.length.toLocaleString("en-US")}/{MAX_INPUT_CHARS.toLocaleString("en-US")}
              </span>
            )}
          </span>
          {busy ? (
            <Button type="button" size="sm" variant="secondary" onClick={stop}>
              <Stop size={13} weight="fill" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()}>
              <ArrowUp size={13} weight="regular" aria-hidden />
              Ask
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
