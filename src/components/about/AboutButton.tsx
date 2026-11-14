"use client";

import { ArrowUpRight, Info } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useWelcome } from "@/components/welcome/welcome-store";
import type { RegionMeta } from "@/lib/moon/types";
import { useApp } from "@/lib/store";
import { useRegion } from "@/lib/use-region";
import { AI_DISCLOSURE, assumptions, mergeSources } from "./content";
import { ValidationCard } from "./ValidationCard";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line border-t pt-4">
      <h3 className="eyebrow mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function steps(meta: RegionMeta | null): { title: string; body: string }[] {
  const h = meta?.horizon;
  return [
    {
      title: "Real terrain",
      body: meta
        ? `NASA's LOLA laser altimeter mapped the ground; we use its heights every ${meta.terrain.step} m across this ${Math.round(meta.extent / 1000)} × ${Math.round(meta.extent / 1000)} km region.`
        : "NASA's LOLA laser altimeter mapped the ground; we use its heights across the region.",
    },
    {
      title: "The skyline from every spot",
      body: h
        ? `For every point ${h.step} m apart we trace the skyline in ${h.azBins} directions, as seen from a ${h.mastHeight} m mast.`
        : "For points on a regular grid we trace the skyline in every direction, as seen from a mast.",
    },
    {
      title: "Sun and Earth against it",
      body: "Hour by hour we place the Sun and Earth in the sky. Above the skyline means sunlight or radio contact; below means shadow or blackout.",
    },
  ];
}

/** Ghost icon button that opens the "About the data" dialog. Mount in the top bar. */
export function AboutButton() {
  const [open, setOpen] = useState(false);
  const regionId = useApp((s) => s.regionId);
  const power = useApp((s) => s.power);
  const { region } = useRegion(regionId);
  const meta = region?.meta ?? null;
  const showWelcome = useWelcome((s) => s.show);

  return (
    <>
      <IconButton label="About" onClick={() => setOpen(true)}>
        <Info size={18} weight="light" />
      </IconButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="About the data"
        description="How Malapert predicts sunlight and Earth contact, and how far you can trust it."
        className="w-[min(640px,calc(100vw-2rem))]"
      >
        <div className="space-y-5">
          <Section title="How it works">
            <ol className="grid gap-3 sm:grid-cols-3">
              {steps(meta).map((s, i) => (
                <li key={s.title} className="rounded-md bg-white/3 p-3 ring-1 ring-line">
                  <div className="tabular text-2xs text-fg-faint">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mt-1 font-medium text-fg text-sm">{s.title}</div>
                  <p className="mt-1 text-fg-muted text-xs">{s.body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <ValidationCard />

          <Section title="Data sources">
            <ul className="space-y-1.5">
              {mergeSources(meta).map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-start gap-1.5 text-fg-muted text-xs transition-colors hover:text-fg"
                  >
                    <span>{s.label}</span>
                    <ArrowUpRight
                      size={12}
                      weight="regular"
                      className="mt-0.5 shrink-0 text-fg-faint group-hover:text-fg"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Assumptions">
            <ul className="space-y-2.5">
              {assumptions(power, meta?.horizon.mastHeight ?? 2).map((a) => (
                <li key={a.title} className="text-xs">
                  <div className="font-medium text-fg">{a.title}</div>
                  <p className="mt-0.5 text-fg-muted">
                    {a.body}
                    {a.source && (
                      <>
                        {" "}
                        <a
                          href={a.source}
                          target="_blank"
                          rel="noreferrer"
                          className="text-fg-faint underline-offset-2 hover:text-fg hover:underline"
                        >
                          Source
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="AI disclosure">
            <p className="text-fg-muted text-xs">{AI_DISCLOSURE}</p>
          </Section>

          <div className="flex justify-end border-line border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                showWelcome();
              }}
            >
              Show welcome screen
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
