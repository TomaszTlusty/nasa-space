"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart } from "ai";
import { useReducer } from "react";
import { type ChatMode, MAX_INPUT_CHARS, type MissionUIMessage } from "@/lib/ai/tools";
import { getChat } from "./chats";

export interface Assistant {
  messages: MissionUIMessage[];
  /** ids of messages whose turn the user stopped (shown with a "Stopped" note) */
  stoppedIds: ReadonlySet<string>;
  /** request in flight, streaming, or a tool still running in the browser */
  busy: boolean;
  error: Error | undefined;
  send: (text: string) => void;
  retry: () => void;
  stop: () => void;
  clear: () => void;
}

/** Shared chat engine for MissionAssistant (science) and GuideChat (student). */
export function useAssistant(mode: ChatMode): Assistant {
  const { chat: instance, stopped } = getChat(mode);
  const chat = useChat<MissionUIMessage>({ chat: instance, throttle: 50 });
  // Stop during a browser-side tool run changes no chat status, so re-render explicitly.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const last = chat.messages.at(-1);
  const toolRunning =
    chat.status !== "error" &&
    last?.role === "assistant" &&
    !stopped.has(last.id) &&
    last.parts.some((p) => isToolUIPart(p) && (p.state === "input-streaming" || p.state === "input-available"));
  const busy = chat.status === "submitted" || chat.status === "streaming" || toolRunning;

  return {
    messages: chat.messages,
    stoppedIds: stopped,
    busy,
    error: chat.error,
    send: (text) => {
      const t = text.trim().slice(0, MAX_INPUT_CHARS);
      if (!t || busy) return;
      if (chat.error) chat.clearError();
      void chat.sendMessage({ text: t });
    },
    retry: () => {
      chat.clearError();
      void chat.regenerate();
    },
    stop: () => {
      const id = instance.messages.at(-1)?.id;
      if (id) stopped.add(id);
      void chat.stop();
      rerender();
    },
    clear: () => {
      void chat.stop();
      stopped.clear();
      chat.clearError();
      chat.setMessages([]);
    },
  };
}
