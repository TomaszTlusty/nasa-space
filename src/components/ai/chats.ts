"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { toolExecutors } from "@/lib/ai/client-tools";
import { type ChatMode, countSteps, MAX_HISTORY, MAX_STEPS, type MissionUIMessage } from "@/lib/ai/tools";

/**
 * One chat per mode, kept at module scope so conversations survive mode switches and panel
 * remounts (switching mode never resets state). Tool calls are executed here, in the browser,
 * against the real analysis engine; results are sent back automatically until the turn is done.
 */

export interface AssistantChat {
  chat: Chat<MissionUIMessage>;
  /**
   * Ids of messages whose turn the user stopped. A stopped turn is never auto-continued, even if a
   * browser-side tool finishes after Stop.
   */
  stopped: Set<string>;
}

function createChat(mode: ChatMode): AssistantChat {
  const stopped = new Set<string>();
  const chat: Chat<MissionUIMessage> = new Chat<MissionUIMessage>({
    transport: new DefaultChatTransport<MissionUIMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { id, mode, messages: messages.slice(-MAX_HISTORY) },
      }),
    }),
    sendAutomaticallyWhen: ({ messages }) => {
      const last = messages.at(-1);
      return (
        last !== undefined &&
        !stopped.has(last.id) &&
        lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
        countSteps(last) < MAX_STEPS
      );
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic) return;
      const { toolCallId } = toolCall;
      try {
        // No await on addToolOutput: avoids deadlocking the stream that delivered this call.
        switch (toolCall.toolName) {
          case "get_context":
            void chat.addToolOutput({
              tool: "get_context",
              toolCallId,
              output: await toolExecutors.get_context(),
            });
            break;
          case "set_mission_window":
            void chat.addToolOutput({
              tool: "set_mission_window",
              toolCallId,
              output: toolExecutors.set_mission_window(toolCall.input),
            });
            break;
          case "slip_launch":
            void chat.addToolOutput({
              tool: "slip_launch",
              toolCallId,
              output: toolExecutors.slip_launch(toolCall.input),
            });
            break;
          case "set_discovery_criteria_and_run":
            void chat.addToolOutput({
              tool: "set_discovery_criteria_and_run",
              toolCallId,
              output: await toolExecutors.set_discovery_criteria_and_run(toolCall.input),
            });
            break;
          case "analyze_point":
            void chat.addToolOutput({
              tool: "analyze_point",
              toolCallId,
              output: await toolExecutors.analyze_point(toolCall.input),
            });
            break;
          case "place_lander":
            void chat.addToolOutput({
              tool: "place_lander",
              toolCallId,
              output: await toolExecutors.place_lander(toolCall.input),
            });
            break;
          case "compare_landers":
            void chat.addToolOutput({
              tool: "compare_landers",
              toolCallId,
              output: await toolExecutors.compare_landers(),
            });
            break;
        }
      } catch (e) {
        void chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId,
          state: "output-error",
          errorText: e instanceof Error ? e.message : "The tool failed.",
        });
      }
    },
  });
  return { chat, stopped };
}

const chats: Partial<Record<ChatMode, AssistantChat>> = {};

export function getChat(mode: ChatMode): AssistantChat {
  chats[mode] ??= createChat(mode);
  return chats[mode];
}
