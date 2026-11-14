"use client";

import { ArrowUpRight, CaretLeft, CaretRight, Check, Play, X } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Divider, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { type ActiveLesson, useLessons } from "./lesson-store";
import { LESSONS } from "./lessons";

/** Right-column panel in Student mode: four short interactive lessons that drive the real scene. */
export function LessonsPanel({ className }: { className?: string }) {
  const active = useLessons((s) => s.active);
  return (
    <Panel className={cn("flex min-h-0 flex-col overflow-hidden", className)} aria-label="Lessons">
      {active ? <LessonPlayer active={active} /> : <LessonList />}
    </Panel>
  );
}

function LessonList() {
  const start = useLessons((s) => s.start);
  return (
    <>
      <header className="px-4 pt-3.5 pb-2">
        <div className="eyebrow mb-0.5">Knowledge pills</div>
        <h2 className="font-medium text-fg text-sm">Learn something in 30 seconds</h2>
      </header>
      <ol className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {LESSONS.map((lesson, i) => (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => start(lesson.id)}
              className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-white/4 active:scale-[0.98]"
            >
              <span className="tabular mt-px text-fg-faint text-xs">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-balance font-medium text-fg text-sm">{lesson.title}</span>
                <span className="mt-0.5 block text-fg-muted text-xs">{lesson.summary}</span>
                <span className="mt-1 block text-2xs text-fg-faint">
                  <span className="tabular">{lesson.steps.length}</span> steps · about{" "}
                  <span className="tabular">30</span> s
                </span>
              </span>
              <Play
                size={14}
                weight="regular"
                aria-hidden
                className="mt-0.5 shrink-0 text-fg-faint transition-colors duration-150 group-hover:text-sun"
              />
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function LessonPlayer({ active }: { active: ActiveLesson }) {
  const goTo = useLessons((s) => s.goTo);
  const exit = useLessons((s) => s.exit);
  const reduceMotion = useReducedMotion();
  const index = LESSONS.findIndex((l) => l.id === active.lessonId);
  const lesson = LESSONS[index];
  if (!lesson) return null;
  const step = lesson.steps[active.step];
  const last = active.step === lesson.steps.length - 1;
  const { Body } = step;

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <div className="eyebrow mb-0.5">
            Lesson <span className="tabular">{index + 1}</span> of <span className="tabular">{LESSONS.length}</span>
          </div>
          <h2 className="text-balance font-medium text-fg text-sm">{lesson.title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={exit} className="-mr-1.5 shrink-0">
          <X size={14} aria-hidden />
          Exit lesson
        </Button>
      </header>

      <div
        className="flex gap-1 px-4"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={1}
        aria-valuemax={lesson.steps.length}
        aria-valuenow={active.step + 1}
      >
        {lesson.steps.map((s, i) => (
          <span
            key={s.title}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors duration-200",
              i <= active.step ? "bg-sun" : "bg-white/10",
            )}
          />
        ))}
      </div>

      <motion.div
        key={`${lesson.id}-${active.step}`}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-3.5"
      >
        <div className="eyebrow">
          Step <span className="tabular">{active.step + 1}</span> of{" "}
          <span className="tabular">{lesson.steps.length}</span>
        </div>
        <h3 className="mt-0.5 mb-1.5 font-medium text-fg text-sm">{step.title}</h3>
        <Body />
        {active.busy && <p className="mt-2 text-2xs text-fg-faint">Setting up the view…</p>}
        {active.note && <p className="mt-2 text-2xs text-fg-muted">{active.note}</p>}
        <a
          href={step.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-1 text-2xs text-fg-faint transition-colors duration-150 hover:text-fg-muted"
        >
          <ArrowUpRight size={12} aria-hidden className="shrink-0" />
          <span className="truncate">Source: {step.source.label}</span>
        </a>
      </motion.div>

      <Divider />
      <footer className="flex items-center justify-between gap-2 px-3 py-2.5">
        <Button variant="ghost" size="sm" disabled={active.step === 0} onClick={() => goTo(active.step - 1)}>
          <CaretLeft size={14} aria-hidden />
          Back
        </Button>
        {last ? (
          <Button variant="primary" size="sm" onClick={exit}>
            <Check size={14} aria-hidden />
            Finish
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => goTo(active.step + 1)}>
            Next
            <CaretRight size={14} aria-hidden />
          </Button>
        )}
      </footer>
    </>
  );
}
