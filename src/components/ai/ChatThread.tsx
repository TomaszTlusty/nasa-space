"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowsLeftRight,
  CalendarBlank,
  CalendarPlus,
  CircleNotch,
  Crosshair,
  ListMagnifyingGlass,
  MagnifyingGlass,
  MapPin,
  WarningCircle,
} from "@phosphor-icons/react";
import { isStaticToolUIPart, type ToolUIPart } from "ai";
import { Fragment, type ReactNode, useEffect, useRef } from "react";
import type {
  MissionUIMessage,
  MissionUITools,
  WindowInfo,
} from "@/lib/ai/tools";
import { cn } from "@/lib/cn";

type Part = MissionUIMessage["parts"][number];
type ToolPart = ToolUIPart<MissionUITools>;

/** Wraps digit runs in the mono tabular face (design rule: every number is tabular). */
function Digits({ text }: { text: string }) {
  return text.split(/([+−-]?\d[\d,.]*)/).map((chunk, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <span key={i} className="tabular">
        {chunk}
      </span>
    ) : (
      chunk
    ),
  );
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
});
const dayMonthFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "1–16 Mar 2027", "28 Feb – 15 Mar 2027", "20 Dec 2027 – 4 Jan 2028" (UTC). */
export function formatWindow(w: WindowInfo): string {
  const a = new Date(w.startUtc);
  const b = new Date(w.endUtc);
  if (a.getUTCFullYear() !== b.getUTCFullYear())
    return `${fullFmt.format(a)} – ${fullFmt.format(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth())
    return `${dayMonthFmt.format(a)} – ${fullFmt.format(b)}`;
  return `${dayFmt.format(a)}–${fullFmt.format(b)}`;
}

interface ChipInfo {
  icon: Icon;
  /** label while the tool runs */
  running: string;
  /** label once the result is in (null until then) */
  done: string | null;
}

function describe(part: ToolPart): ChipInfo {
  switch (part.type) {
    case "tool-get_context":
      return {
        icon: ListMagnifyingGlass,
        running: "Reading mission setup",
        done: part.output ? "Read mission setup" : null,
      };
    case "tool-set_mission_window":
      return {
        icon: CalendarBlank,
        running: "Setting mission window",
        done: part.output
          ? `Set window ${formatWindow(part.output.window)}`
          : null,
      };
    case "tool-slip_launch": {
      const d = part.output?.slippedDays;
      return {
        icon: CalendarPlus,
        running: "Slipping launch",
        done: part.output
          ? `Slipped ${d && d > 0 ? "+" : ""}${d} d → ${formatWindow(part.output.window)}`
          : null,
      };
    }
    case "tool-set_discovery_criteria_and_run":
      return {
        icon: MagnifyingGlass,
        running: "Searching the terrain grid",
        done: part.output
          ? `Searched ${part.output.gridPointsSearched.toLocaleString("en-US")} grid points · ${part.output.resultCount} found`
          : null,
      };
    case "tool-analyze_point":
      return {
        icon: Crosshair,
        running: "Analysing a spot",
        done: part.output ? `Analysed ${part.output.label}` : null,
      };
    case "tool-place_lander":
      return {
        icon: MapPin,
        running: `Placing lander${part.input?.lander ? ` ${part.input.lander}` : ""}`,
        done: part.output
          ? `Placed ${part.output.lander} at ${part.output.label}`
          : null,
      };
    case "tool-compare_landers":
      return {
        icon: ArrowsLeftRight,
        running: "Comparing A and B",
        done: part.output ? "Compared A and B" : null,
      };
  }
}

function ToolChip({ part }: { part: ToolPart }) {
  const info = describe(part);
  const failed =
    part.state === "output-error" || part.state === "output-denied";
  const done = part.state === "output-available" ? info.done : null;
  const Glyph = failed ? WarningCircle : done ? info.icon : CircleNotch;
  const label = failed
    ? `${info.running} failed`
    : (done ?? `${info.running}…`);

  return (
    <span
      title={part.state === "output-error" ? part.errorText : undefined}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full px-2 text-2xs ring-1",
        "transition-[opacity,transform] duration-200 ease-(--ease-out) starting:translate-y-1 starting:opacity-0",
        failed
          ? "bg-danger-soft text-danger ring-danger/25"
          : "bg-white/5 text-fg-muted ring-line",
      )}
    >
      <Glyph
        size={13}
        weight="regular"
        className={cn("shrink-0", !failed && !done && "animate-spin")}
        aria-hidden
      />
      <span className="truncate">
        <Digits text={label} />
      </span>
    </span>
  );
}

/** Inline **bold** only. */
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <strong key={i} className="font-medium text-fg">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <Fragment key={i}>{chunk}</Fragment>
    ),
  );
}

/** Minimal, safe rendering of the model's text: paragraphs, "- " bullets, **bold**. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul
        key={`ul${blocks.length}`}
        className="flex list-disc flex-col gap-1 pl-4 marker:text-fg-faint"
      >
        {bullets.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines of an append-only stream
          <li key={i}>
            <Inline text={b} />
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(t);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (t)
      blocks.push(
        <p key={`p${blocks.length}`}>
          <Inline text={t.replace(/^#+\s*/, "")} />
        </p>,
      );
  }
  flush();
  return <div className="flex flex-col gap-2">{blocks}</div>;
}

type Block =
  | { kind: "tools"; parts: ToolPart[] }
  | { kind: "text"; text: string };

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

export function ChatThread({
  messages,
  busy,
  assistantName,
  className,
}: {
  messages: MissionUIMessage[];
  busy: boolean;
  assistantName: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const last = messages.at(-1);
  const thinking =
    busy &&
    (last?.role === "user" || last?.parts.at(-1)?.type === "step-start");

  // keep the newest content in view while streaming, unless the user scrolled up to read
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current && messages.length > 0)
      el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      aria-live="polite"
      aria-busy={busy}
      className={cn(
        "flex flex-col gap-4 overflow-y-auto overscroll-contain",
        className,
      )}
    >
      {messages.map((m) =>
        m.role === "user" ? (
          <div
            key={m.id}
            className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-lg rounded-br-xs bg-white/7 px-3 py-2 text-fg text-sm"
          >
            {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
          </div>
        ) : (
          <div key={m.id} className="flex flex-col gap-2">
            <div className="eyebrow">{assistantName}</div>
            {toBlocks(m.parts).map((b, i) =>
              b.kind === "tools" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks only append while streaming
                <div key={i} className="flex flex-wrap gap-1.5">
                  {b.parts.map((p) => (
                    <ToolChip key={p.toolCallId} part={p} />
                  ))}
                </div>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: blocks only append while streaming
                <div key={i} className="text-fg/90 text-sm leading-relaxed">
                  <RichText text={b.text} />
                </div>
              ),
            )}
          </div>
        ),
      )}
      {thinking && (
        <div className="animate-pulse text-fg-faint text-xs">Thinking…</div>
      )}
    </div>
  );
}
