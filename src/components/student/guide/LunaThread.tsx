"use client";

import { Stop, WarningCircle } from "@phosphor-icons/react";
import { isStaticToolUIPart, type ToolUIPart } from "ai";
import { motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useRef } from "react";
import { formatWindow } from "@/components/ai/ChatThread";
import type { MissionUIMessage, MissionUITools } from "@/lib/ai/tools";
import { cn } from "@/lib/cn";
import { Luna } from "./Luna";
import { LunaRichText, Numbers } from "./LunaText";
import { LUNA_COLORS } from "./moods";

type Part = MissionUIMessage["parts"][number];
type ToolPart = ToolUIPart<MissionUITools>;

/** What LUNA did, in friendly words: [while running, once done (null until the result is in)]. */
function describe(part: ToolPart): [string, string | null] {
  switch (part.type) {
    case "tool-get_context":
      return ["LUNA is checking your mission…", part.output ? "LUNA checked your mission" : null];
    case "tool-set_mission_window":
      return [
        "LUNA is changing the dates…",
        part.output ? `LUNA set the dates to ${formatWindow(part.output.window)}` : null,
      ];
    case "tool-slip_launch": {
      const d = part.output?.slippedDays ?? 0;
      return [
        "LUNA is moving the launch date…",
        part.output ? `LUNA moved the launch ${Math.abs(d)} days ${d >= 0 ? "later" : "earlier"}` : null,
      ];
    }
    case "tool-set_discovery_criteria_and_run":
      return [
        "LUNA is searching the terrain…",
        part.output
          ? part.output.resultCount > 0
            ? `LUNA searched ${part.output.gridPointsSearched.toLocaleString("en-US")} spots and found ${part.output.resultCount} good ones`
            : `LUNA searched ${part.output.gridPointsSearched.toLocaleString("en-US")} spots but none fit yet`
          : null,
      ];
    case "tool-analyze_point":
      return ["LUNA is checking a spot…", part.output ? `LUNA checked ${part.output.label}` : null];
    case "tool-place_lander":
      return [
        "LUNA is moving a lander…",
        part.output ? `LUNA moved lander ${part.output.lander} to ${part.output.label}` : null,
      ];
    case "tool-compare_landers":
      return ["LUNA is comparing the landers…", part.output ? "LUNA compared landers A and B" : null];
  }
}

function ToolLine({ part, stopped }: { part: ToolPart; stopped: boolean }) {
  const [running, done] = describe(part);
  const failed = part.state === "output-error" || part.state === "output-denied";
  const finished = part.state === "output-available" ? done : null;
  const text = failed
    ? "LUNA couldn't finish that step"
    : finished
      ? finished
      : stopped
        ? `${running.replace(/…$/, "")} (stopped)`
        : running;
  return (
    <div
      title={part.state === "output-error" ? part.errorText : undefined}
      className={cn(
        "flex items-center gap-2 text-xs",
        "transition-[opacity,transform] duration-200 ease-(--ease-out) starting:translate-y-1 starting:opacity-0",
        failed ? "text-danger" : "text-fg-muted",
      )}
    >
      {failed ? (
        <WarningCircle size={13} weight="regular" aria-hidden className="shrink-0" />
      ) : (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", !finished && !stopped && "animate-pulse")}
          style={{ background: LUNA_COLORS.lilac }}
        />
      )}
      <span className="min-w-0">
        <Numbers text={text} />
      </span>
    </div>
  );
}

type Block = { kind: "tools"; parts: ToolPart[] } | { kind: "text"; text: string };

function toBlocks(parts: Part[]): Block[] {
  const blocks: Block[] = [];
  for (const p of parts) {
    const prev = blocks.at(-1);
    if (isStaticToolUIPart(p)) {
      if (prev?.kind === "tools") prev.parts.push(p);
      else blocks.push({ kind: "tools", parts: [p] });
    } else if (p.type === "text" && p.text.trim()) {
      if (prev?.kind === "text") prev.text += `\n\n${p.text}`;
      else blocks.push({ kind: "text", text: p.text });
    }
  }
  return blocks;
}

function ThinkingDots() {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-fg-muted"
          animate={reduce ? { opacity: 0.8 } : { opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

/** Student chat: LUNA's answers beside a mini LUNA, the student's questions as right-aligned bubbles. */
export function LunaThread({
  messages,
  stoppedIds,
  busy,
  className,
}: {
  messages: MissionUIMessage[];
  stoppedIds: ReadonlySet<string>;
  busy: boolean;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const last = messages.at(-1);
  // "Thinking" until the current step shows text or a tool line (reasoning parts are not shown)
  const currentStep =
    last?.role === "assistant" ? last.parts.slice(last.parts.findLastIndex((p) => p.type === "step-start") + 1) : [];
  const thinking =
    busy &&
    (last?.role === "user" ||
      !currentStep.some((p) => (p.type === "text" && p.text.trim() !== "") || isStaticToolUIPart(p)));

  // keep the newest content in view while streaming, unless the student scrolled up to read
  const stoppedCount = stoppedIds.size;
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current && (messages.length > 0 || stoppedCount > 0 || thinking)) el.scrollTop = el.scrollHeight;
  }, [messages, stoppedCount, thinking]);

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      aria-live="polite"
      aria-busy={busy}
      className={cn("flex flex-col gap-3 overflow-y-auto overscroll-contain", className)}
    >
      {messages.map((m) => (
        <Fragment key={m.id}>
          {m.role === "user" ? (
            <div
              className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3 py-2 text-fg text-sm"
              style={{ background: "oklch(0.78 0.12 300 / 0.2)" }}
            >
              {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Luna mood="happy" lively={false} className="mt-0.5 size-8 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="sr-only">LUNA:</span>
                {toBlocks(m.parts).map((b, i) =>
                  b.kind === "tools" ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: blocks only append while streaming
                    <div key={i} className="flex flex-col gap-1">
                      {b.parts.map((p) => (
                        <ToolLine key={p.toolCallId} part={p} stopped={stoppedIds.has(m.id)} />
                      ))}
                    </div>
                  ) : (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: blocks only append while streaming
                      key={i}
                      className="rounded-2xl rounded-tl-md bg-white/6 px-3 py-2 text-fg/90 text-sm leading-relaxed"
                    >
                      <LunaRichText text={b.text} />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
          {stoppedIds.has(m.id) && (
            <div className="-mt-1 flex items-center gap-1.5 pl-10 text-2xs text-fg-faint">
              <Stop size={11} weight="fill" aria-hidden />
              Stopped. Ask again to keep going.
            </div>
          )}
        </Fragment>
      ))}
      {thinking && (
        <div className="flex items-center gap-2">
          <Luna mood="thinking" lively={false} className="size-8 shrink-0" />
          <span className="flex items-center gap-1.5 text-fg-muted text-xs">
            LUNA is thinking
            <ThinkingDots />
          </span>
        </div>
      )}
    </div>
  );
}
