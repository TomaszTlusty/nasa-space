"use client";

import { ArrowUpRight, ChatCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { GuideChat } from "@/components/ai/GuideChat";
import { Button, IconButton } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useGuide } from "./guide-store";
import { LunaBot } from "./LunaBot";
import { useGuideEvents } from "./useGuideEvents";

/** Unread bubbles fade away on their own after this long (paused while hovered, chatting or tab hidden). */
const AUTO_HIDE_MS = 16_000;
/** Breather between two queued messages so the bot never feels like a ticker. */
const GAP_MS = 900;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * LUNA-Bot, the Student-mode guide: a small avatar floating above the bottom-right of the scene with a
 * speech bubble that reacts to what happens on the Moon, plus an "Ask a question" chat expander.
 * Mount once in the AppShell `overlay` slot; it positions itself and renders nothing outside Student mode.
 */
export function Guide() {
  const mode = useApp((s) => s.mode);
  return mode === "student" ? <GuideDock /> : null;
}

function GuideDock() {
  useGuideEvents();
  const current = useGuide((s) => s.current);
  const queued = useGuide((s) => s.queue.length);
  const dismiss = useGuide((s) => s.dismiss);
  const advance = useGuide((s) => s.advance);
  const [chatOpen, setChatOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onChange = () =>
      setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (current || queued === 0) return;
    const t = window.setTimeout(advance, GAP_MS);
    return () => window.clearTimeout(t);
  }, [current, queued, advance]);

  useEffect(() => {
    if (!current || hovered || chatOpen || !pageVisible) return;
    const t = window.setTimeout(dismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [current, hovered, chatOpen, pageVisible, dismiss]);

  const showBubble = current !== null || chatOpen;

  return (
    <div className="pointer-events-none absolute right-3 bottom-[156px] z-20 flex flex-col items-end gap-2 md:right-[384px]">
      <AnimatePresence>
        {showBubble && (
          <motion.section
            key="bubble"
            aria-label="LUNA-Bot"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: "translateY(6px) scale(0.97)" }
            }
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, transform: "translateY(0px) scale(1)" }
            }
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    transform: "translateY(4px) scale(0.98)",
                    transition: { duration: 0.14, ease: EASE_OUT },
                  }
            }
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            className="glass pointer-events-auto flex max-h-[calc(100dvh-240px)] w-[320px] max-w-[calc(100vw-24px)] origin-bottom-right flex-col overflow-hidden rounded-xl"
          >
            <header className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-3.5">
              <span className="eyebrow">LUNA-Bot</span>
              <IconButton
                size="sm"
                label={current ? "Dismiss message" : "Close chat"}
                onClick={() => (current ? dismiss() : setChatOpen(false))}
              >
                <X size={14} aria-hidden />
              </IconButton>
            </header>

            <div className="min-h-0 overflow-y-auto">
              <motion.div
                key={current?.key ?? "chat"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
                role="status"
                aria-live="polite"
                className="px-3.5 pb-2"
              >
                {current ? (
                  <>
                    <p className="text-pretty text-fg text-sm">
                      {current.text}
                    </p>
                    {current.source && (
                      <a
                        href={current.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex max-w-full items-center gap-1 text-2xs text-fg-faint transition-colors duration-150 hover:text-fg-muted"
                      >
                        <ArrowUpRight
                          size={12}
                          aria-hidden
                          className="shrink-0"
                        />
                        <span className="truncate">
                          Source: {current.source.label}
                        </span>
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-pretty text-fg-muted text-sm">
                    Ask me anything about the Moon's south pole: sunlight,
                    shadows, Earth or landing.
                  </p>
                )}
              </motion.div>

              {chatOpen && (
                <div className="border-line border-t px-3.5 pt-2.5 pb-3">
                  <GuideChat compact />
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-line border-t px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={chatOpen}
                onClick={() => setChatOpen((o) => !o)}
              >
                <ChatCircle size={14} aria-hidden />
                {chatOpen ? "Hide questions" : "Ask a question"}
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
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={chatOpen ? "Hide LUNA-Bot chat" : "Ask LUNA-Bot a question"}
        aria-expanded={chatOpen}
        onClick={() => setChatOpen((o) => !o)}
        className="glass pointer-events-auto grid size-12 place-items-center rounded-full text-fg-muted transition-[transform,color] duration-150 ease-(--ease-out) hover:text-fg active:scale-[0.97]"
      >
        <LunaBot className="size-8" />
      </button>
    </div>
  );
}
