"use client";

import { ArrowUpRight, ChatCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { GuideChat } from "@/components/ai/GuideChat";
import { useAssistant } from "@/components/ai/use-assistant";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { type GuideMessage, useGuide } from "./guide-store";
import { Luna } from "./Luna";
import { Numbers } from "./LunaText";
import { LUNA_COLORS, MOOD_ACCENT, type Mood } from "./moods";
import { Sparkles } from "./Sparkles";
import { useGuideEvents } from "./useGuideEvents";

/** Unread bubbles fade away on their own this long after LUNA finishes talking (paused while hovered, chatting or tab hidden). */
const AUTO_HIDE_MS = 16_000;
/** Breather between two queued messages so LUNA never feels like a ticker. */
const GAP_MS = 900;
/** Typewriter speed. */
const CHARS_PER_SECOND = 40;
/** How long LUNA beams after being tapped. */
const POKE_MS = 1200;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Solid, slightly lilac surface: friendlier than the HUD glass, still on the dark palette. */
const BUBBLE_BG = "oklch(0.25 0.025 290)";

/**
 * LUNA, the Student-mode guide: an astronaut-robot mascot floating above the timeline (bottom-left on phones,
 * beside the right column from md up) with a speech bubble that reacts to what happens on the Moon, and an
 * "Ask LUNA" chat. Mount once in the AppShell `overlay` slot; it sits at z-10, below the mobile sheets (z-20),
 * and renders nothing outside Student mode.
 */
export function Guide() {
  const mode = useApp((s) => s.mode);
  return mode === "student" ? <GuideDock /> : null;
}

/** Typewriter reveal. Space for the whole text is reserved up front so the bubble never grows line by line. */
function RevealText({ text, onTalking }: { text: string; onTalking: (talking: boolean) => void }) {
  const len = text.length;
  // Read at mount (not via motion's hook, which caches the preference for the dock's lifetime).
  const [instant] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = useState(instant ? len : 0);
  const done = shown >= len;

  useEffect(() => {
    onTalking(!done);
  }, [done, onTalking]);
  useEffect(() => () => onTalking(false), [onTalking]);

  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const next = Math.min(len, Math.floor(((now - start) / 1000) * CHARS_PER_SECOND));
      setShown((cur) => Math.max(cur, next));
      if (next < len) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [instant, len]);

  return (
    // Visual only (aria-hidden): the full text is announced once by the dock's live region, and click-to-skip is a
    // pointer shortcut; keyboard users lose nothing without it.
    <p
      aria-hidden="true"
      onClick={() => setShown(len)}
      className="grid text-pretty text-base text-fg leading-relaxed"
      style={{ cursor: done ? undefined : "pointer" }}
    >
      <span className="invisible col-start-1 row-start-1">
        <Numbers text={text} />
      </span>
      <span className="col-start-1 row-start-1">
        <Numbers text={text.slice(0, shown)} />
      </span>
    </p>
  );
}

function MessageBody({ message, onTalking }: { message: GuideMessage; onTalking: (talking: boolean) => void }) {
  return (
    <div className="px-4 pb-2">
      <RevealText key={message.key} text={message.text} onTalking={onTalking} />
      {message.source && (
        <a
          href={message.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex max-w-full items-center gap-1 text-2xs text-fg-faint transition-colors duration-150 hover:text-fg-muted"
        >
          <ArrowUpRight size={12} aria-hidden className="shrink-0" />
          <span className="truncate">Source: {message.source.label}</span>
        </a>
      )}
    </div>
  );
}

function GuideDock() {
  useGuideEvents();
  const current = useGuide((s) => s.current);
  const queued = useGuide((s) => s.queue.length);
  const dismiss = useGuide((s) => s.dismiss);
  const advance = useGuide((s) => s.advance);
  const { busy } = useAssistant("student");
  const [chatOpen, setChatOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [talking, setTalking] = useState(false);
  const [poked, setPoked] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const [wiggleScope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (current || queued === 0) return;
    const t = window.setTimeout(advance, GAP_MS);
    return () => window.clearTimeout(t);
  }, [current, queued, advance]);

  useEffect(() => {
    if (!current || talking || hovered || chatOpen || !pageVisible) return;
    const t = window.setTimeout(dismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [current, talking, hovered, chatOpen, pageVisible, dismiss]);

  useEffect(() => {
    if (!poked) return;
    const t = window.setTimeout(() => setPoked(false), POKE_MS);
    return () => window.clearTimeout(t);
  }, [poked]);

  // One sparkle burst per excited message.
  const [burst, setBurst] = useState(0);
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const excitedKey = current?.mood === "excited" ? current.key : null;
  if (excitedKey !== burstKey) {
    setBurstKey(excitedKey);
    if (excitedKey) setBurst((n) => n + 1);
  }

  const showBubble = current !== null || chatOpen;

  // The bubble can vanish or change under a resting pointer without a pointerleave; forget the hover then so the
  // auto-hide timer is never stuck. Any pointer movement over the new bubble marks it hovered again.
  const bubbleKey = showBubble ? (current?.key ?? "chat") : null;
  const [hoveredKey, setHoveredKey] = useState(bubbleKey);
  if (hoveredKey !== bubbleKey) {
    setHoveredKey(bubbleKey);
    setHovered(false);
  }

  const mood: Mood = poked ? "happy" : busy ? "thinking" : (current?.mood ?? "idle");
  const accent = MOOD_ACCENT[current?.mood ?? (busy ? "thinking" : "idle")];

  const pressLuna = () => {
    setPoked(true);
    setChatOpen((o) => !o);
    if (!reduceMotion && wiggleScope.current) {
      animate(wiggleScope.current, { rotate: [0, -9, 7, -4, 2, 0] }, { duration: 0.55, ease: "easeOut" });
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-[150px] left-3 z-10 flex flex-col items-start gap-1 md:right-[384px] md:left-auto md:items-end">
      <output aria-live="polite" className="sr-only">
        {current ? `LUNA says: ${current.text}` : ""}
      </output>

      <AnimatePresence>
        {showBubble && (
          <motion.section
            key="bubble"
            aria-label="LUNA"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px) scale(0.96)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    transform: "translateY(6px) scale(0.97)",
                    transition: { duration: 0.15, ease: EASE_OUT },
                  }
            }
            transition={{ type: "spring", bounce: 0, visualDuration: 0.26 }}
            onPointerMove={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            className="pointer-events-auto relative mb-2 w-[340px] max-w-[calc(100vw-1.5rem)] origin-bottom-left md:origin-bottom-right"
          >
            <div
              className="flex max-h-[calc(100dvh-410px)] flex-col overflow-hidden rounded-2xl shadow-(--shadow-pop) ring-1 ring-white/10 md:max-h-[calc(100dvh-340px)]"
              style={{ background: BUBBLE_BG }}
            >
              <div
                aria-hidden
                className="h-1 shrink-0 transition-[background-color] duration-300"
                style={{ backgroundColor: accent }}
              />
              <header className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-4">
                <span className="font-medium text-sm" style={{ color: LUNA_COLORS.lilac }}>
                  LUNA
                </span>
                <IconButton
                  size="sm"
                  label={current ? "Dismiss message" : "Close chat"}
                  onClick={() => (current ? dismiss() : setChatOpen(false))}
                >
                  <X size={14} aria-hidden />
                </IconButton>
              </header>

              {/* With the chat open, the event message gets a short scroll of its own so the chat input never scrolls away. */}
              <div className="flex min-h-0 flex-1 flex-col">
                {current ? (
                  <motion.div
                    key={current.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    className={cn("overflow-y-auto", chatOpen ? "max-h-24 shrink-0 md:max-h-36" : "min-h-0")}
                  >
                    <MessageBody message={current} onTalking={setTalking} />
                  </motion.div>
                ) : (
                  !chatOpen && (
                    <p className="px-4 pb-2 text-base text-fg leading-relaxed">
                      Got a question about the Moon? Ask me anything: sunlight, shadows, Earth or landing!
                    </p>
                  )
                )}

                {chatOpen && (
                  <div
                    className={cn("flex min-h-0 flex-1 flex-col px-4 pt-3 pb-3", current && "border-white/8 border-t")}
                  >
                    <GuideChat compact />
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-between gap-2 border-white/8 border-t px-2 py-1.5">
                <Button variant="ghost" size="sm" aria-expanded={chatOpen} onClick={() => setChatOpen((o) => !o)}>
                  <ChatCircle size={14} aria-hidden />
                  {chatOpen ? "Hide chat" : "Ask LUNA"}
                </Button>
                {current && queued > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      dismiss();
                      advance();
                    }}
                  >
                    Next <span className="tabular text-fg-faint">{queued}</span>
                  </Button>
                )}
              </footer>
            </div>
            {/* tail pointing down at LUNA */}
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-[29px] size-3.5 rotate-45 rounded-[3px] md:right-[45px] md:left-auto"
              style={{ background: BUBBLE_BG }}
            />
          </motion.section>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
        <Sparkles burst={burst} />
        <button
          type="button"
          aria-label={chatOpen ? "Close Ask LUNA" : "Ask LUNA a question"}
          aria-expanded={chatOpen}
          onClick={pressLuna}
          className="relative block rounded-full transition-transform duration-150 ease-(--ease-out) active:scale-[0.96]"
        >
          <span
            aria-hidden
            className="absolute bottom-0 left-1/2 h-2 w-1/2 -translate-x-1/2 rounded-full bg-black/45 blur-[3px]"
          />
          <span ref={wiggleScope} className="block origin-bottom">
            <Luna
              mood={mood}
              talking={talking && current !== null && !busy}
              className="size-[72px] drop-shadow-[0_6px_10px_oklch(0_0_0/0.45)] md:size-[104px]"
            />
          </span>
        </button>
      </div>
    </div>
  );
}
