"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart } from "ai";
import {
  type ChatMode,
  MAX_INPUT_CHARS,
  type MissionUIMessage,
} from "@/lib/ai/tools";
import { getChat } from "./chats";

export interface Assistant {
  messages: MissionUIMessage[];
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
  const chat = useChat<MissionUIMessage>({ chat: getChat(mode), throttle: 50 });
  const last = chat.messages.at(-1);
  const toolRunning =
    chat.status !== "error" &&
    last?.role === "assistant" &&
    last.parts.some(
      (p) =>
        isToolUIPart(p) &&
        (p.state === "input-streaming" || p.state === "input-available"),
    );
  const busy =
    chat.status === "submitted" || chat.status === "streaming" || toolRunning;

  return {
    messages: chat.messages,
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
    stop: chat.stop,
    clear: () => {
      void chat.stop();
      chat.clearError();
      chat.setMessages([]);
    },
  };
}
