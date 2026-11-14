"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  ArrowRight,
  Crosshair,
  GraduationCap,
  type Icon,
  X,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { type Mode, useApp } from "@/lib/store";
import { useWelcome } from "./welcome-store";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** 6 items x 48 ms + 300 ms = 540 ms: the whole entrance stays under 600 ms */
const STAGGER_S = 0.048;
const ITEM_S = 0.3;

/** Fade-up for one entrance step; reduced motion keeps the fade and drops the movement. */
function Reveal({
  step,
  className,
  children,
}: {
  step: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, transform: reduce ? "none" : "translateY(10px)" }}
      animate={{ opacity: 1, transform: reduce ? "none" : "translateY(0px)" }}
      transition={{
        duration: reduce ? 0.2 : ITEM_S,
        ease: EASE_OUT,
        delay: reduce ? 0 : step * STAGGER_S,
      }}
    >
      {children}
    </motion.div>
  );
}

function ModeTile({
  icon: TileIcon,
  title,
  body,
  onClick,
}: {
  icon: Icon;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group glass flex h-full w-full flex-col items-start gap-8 rounded-xl p-5 text-left transition-[transform,background-color] duration-150 ease-(--ease-out) hover:bg-surface-2/85 active:scale-[0.98]"
    >
      <span className="flex w-full items-center justify-between">
        <span className="inline-flex size-10 items-center justify-center rounded-md bg-white/5 text-fg ring-1 ring-line">
          <TileIcon size={18} weight="light" />
        </span>
        <ArrowRight
          size={16}
          weight="regular"
          className="text-fg-faint transition-[transform,color] duration-150 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:text-fg"
        />
      </span>
      <span>
        <span className="block font-medium text-fg text-lg tracking-[-0.01em]">
          {title}
        </span>
        <span className="mt-1 block text-fg-muted text-sm">{body}</span>
      </span>
    </button>
  );
}

/**
 * First-visit welcome: the live Moon stays visible behind a scrim; two tiles pick the mode and close.
 * Mount once (AppShell `overlay` slot). Reopen with `useWelcome.getState().show()`.
 */
export function Welcome() {
  const open = useWelcome((s) => s.open);
  const dismiss = useWelcome((s) => s.dismiss);
  const setMode = useApp((s) => s.setMode);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useWelcome.getState().showIfFirstVisit();
  }, []);

  const choose = (mode: Mode) => {
    setMode(mode);
    dismiss();
  };

  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => !next && dismiss()}>
      <BaseDialog.Portal>
        {/* Scrim darkest behind the text, lighter on the right so the Moon reads through. */}
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-linear-to-r from-canvas/92 via-canvas/75 to-canvas/45 transition-opacity duration-300 ease-(--ease-out) data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-200" />
        <BaseDialog.Popup
          ref={popupRef}
          initialFocus={popupRef}
          className="fixed inset-0 z-50 overflow-y-auto outline-none transition-opacity duration-200 ease-(--ease-out) data-ending-style:opacity-0"
        >
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-6 md:px-12 md:py-10">
            <Reveal step={0} className="flex items-center justify-between">
              <span className="font-medium text-fg text-sm tracking-[-0.01em]">
                Malapert
              </span>
              <BaseDialog.Close
                aria-label="Close welcome screen"
                className="inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-[transform,background-color,color] duration-150 ease-(--ease-out) hover:bg-white/5 hover:text-fg active:scale-[0.97]"
              >
                <X size={16} weight="light" />
              </BaseDialog.Close>
            </Reveal>

            <div className="flex flex-1 flex-col justify-center py-12 md:py-16">
              <Reveal step={1}>
                <BaseDialog.Title className="max-w-[22ch] font-medium text-[clamp(2.25rem,5vw,4.25rem)] text-fg leading-[1.04] tracking-[-0.035em]">
                  Where and when can you land at the Moon's south pole?
                </BaseDialog.Title>
              </Reveal>
              <Reveal step={2}>
                <BaseDialog.Description className="mt-5 max-w-[46ch] text-base text-fg-muted md:text-lg">
                  Real lunar terrain and Sun and Earth positions show where a
                  lander keeps its power and its radio link home.
                </BaseDialog.Description>
              </Reveal>

              <div className="mt-10 grid max-w-3xl gap-3 md:grid-cols-2">
                <Reveal step={3}>
                  <ModeTile
                    icon={Crosshair}
                    title="Mission planning"
                    body="Compare landing sites and dates, solar power and contact with Earth."
                    onClick={() => choose("science")}
                  />
                </Reveal>
                <Reveal step={4}>
                  <ModeTile
                    icon={GraduationCap}
                    title="Explore & learn"
                    body="Guided lessons with LUNA-Bot and a land-and-survive game."
                    onClick={() => choose("student")}
                  />
                </Reveal>
              </div>
            </div>

            <Reveal
              step={5}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-line border-t pt-4 text-fg-faint text-xs"
            >
              <span>
                Built on NASA LOLA terrain and JPL-validated ephemerides
              </span>
              <span>Team — NASA Space Apps 2026</span>
            </Reveal>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
