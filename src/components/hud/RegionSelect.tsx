"use client";

import { Select } from "@base-ui/react/select";
import { CaretUpDown, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { type RegionId, useApp } from "@/lib/store";

/** Names match `public/regions/<id>/meta.json`; subtitles are one-line plain-language summaries of it. */
const REGIONS: {
  value: RegionId;
  label: string;
  short: string;
  subtitle: string;
}[] = [
  {
    value: "shackleton",
    label: "Shackleton & Connecting Ridge",
    short: "Shackleton Ridge",
    subtitle: "Most sunlit ridge on the Moon",
  },
  {
    value: "malapert",
    label: "Malapert Massif",
    short: "Malapert Massif",
    subtitle: "5 km high candidate mountain",
  },
];

export function RegionSelect({ className }: { className?: string }) {
  const regionId = useApp((s) => s.regionId);
  const setRegion = useApp((s) => s.setRegion);
  const current = REGIONS.find((r) => r.value === regionId) ?? REGIONS[0];

  return (
    <Select.Root<RegionId>
      items={REGIONS}
      value={regionId}
      onValueChange={(v) => {
        if (v && v !== regionId) setRegion(v);
      }}
    >
      <Select.Trigger
        aria-label={`Region: ${current.label}`}
        className={cn(
          "flex h-10 min-w-0 select-none items-center gap-2 rounded-full py-1 pr-2.5 pl-3.5 text-left",
          "transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-white/5 active:scale-[0.97]",
          "data-popup-open:bg-white/5",
          className,
        )}
      >
        <span className="flex min-w-0 flex-col leading-none">
          <Select.Value className="truncate font-medium text-fg text-xs">
            {() => (
              <>
                <span className="2xl:hidden">{current.short}</span>
                <span className="max-2xl:hidden">{current.label}</span>
              </>
            )}
          </Select.Value>
          <span className="mt-1 truncate text-2xs text-fg-faint max-xl:hidden">{current.subtitle}</span>
        </span>
        <Select.Icon className="shrink-0 text-fg-faint">
          <CaretUpDown size={14} weight="regular" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-40 select-none outline-none" sideOffset={8} alignItemWithTrigger={false}>
          <Select.Popup
            className={cn(
              "glass min-w-(--anchor-width) origin-(--transform-origin) rounded-lg bg-glass-strong p-1 shadow-(--shadow-pop) outline-none",
              "transition-[transform,opacity] duration-150 ease-(--ease-out)",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0",
            )}
          >
            <Select.List className="outline-none">
              {REGIONS.map((r) => (
                <Select.Item
                  key={r.value}
                  value={r.value}
                  className={cn(
                    "grid cursor-default grid-cols-[1rem_1fr] items-start gap-2 rounded-md py-2 pr-4 pl-2.5 outline-none",
                    "data-highlighted:bg-white/6",
                  )}
                >
                  <Select.ItemIndicator className="col-start-1 mt-0.5 text-sun">
                    <Check size={14} weight="regular" />
                  </Select.ItemIndicator>
                  <span className="col-start-2 flex flex-col gap-0.5">
                    <Select.ItemText className="font-medium text-fg text-sm">{r.label}</Select.ItemText>
                    <span className="text-fg-faint text-xs">{r.subtitle}</span>
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
