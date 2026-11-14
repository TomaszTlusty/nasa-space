"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/cn";

const popupMotion =
  "origin-(--transform-origin) transition-[transform,opacity] duration-150 ease-(--ease-out) " +
  "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0";

export const TooltipProvider = BaseTooltip.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
          <BaseTooltip.Popup
            className={cn(
              "max-w-64 rounded-sm bg-surface-3 px-2.5 py-1.5 text-fg text-xs shadow-(--shadow-pop) ring-1 ring-line-strong",
              "data-instant:transition-none",
              popupMotion,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export function Popover({
  trigger,
  children,
  side = "bottom",
  align = "center",
  className,
}: {
  trigger: ReactElement;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={8} className="z-40">
          <BasePopover.Popup
            className={cn(
              "glass rounded-lg bg-glass-strong p-3 text-sm shadow-(--shadow-pop) outline-none",
              popupMotion,
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/55 transition-opacity duration-200 ease-(--ease-out) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "glass fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-glass-strong",
            "transition-[transform,opacity] duration-200 ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <BaseDialog.Title className="font-medium text-fg text-lg tracking-[-0.01em]">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-1 text-fg-muted text-sm">{description}</BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              aria-label="Close"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              <X size={16} weight="light" />
            </BaseDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Switch.Root renders the control inside the label
    <label className={cn("flex cursor-pointer select-none items-center justify-between gap-3 text-fg-muted text-xs", className)}>
      <span>{label}</span>
      <BaseSwitch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-white/10 p-0.5 ring-1 ring-line transition-colors duration-150 data-checked:bg-sun"
      >
        <BaseSwitch.Thumb className="size-4 rounded-full bg-fg shadow-[0_1px_3px_oklch(0_0_0/0.5)] transition-transform duration-150 ease-(--ease-out) data-checked:translate-x-4 data-checked:bg-[oklch(0.2_0.03_70)]" />
      </BaseSwitch.Root>
    </label>
  );
}
