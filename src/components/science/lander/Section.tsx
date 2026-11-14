import { ArrowSquareOut } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One titled block inside the lander panel. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-line border-t px-4 py-3", className)}>
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SourceLink({ href, children = "Source" }: { href: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-2xs text-fg-faint underline-offset-2 transition-colors hover:text-fg-muted hover:underline"
    >
      {children}
      <ArrowSquareOut size={11} weight="regular" />
    </a>
  );
}
