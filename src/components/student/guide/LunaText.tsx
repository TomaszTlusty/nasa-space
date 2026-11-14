import { Fragment, type ReactNode } from "react";

/** A number with an optional unit ("76%", "−238 °C", "1.5°", "112 h"): digits in the mono face, never wrapped. */
const NUMBER = /([+−-]?\d[\d,.]*(?:\s?(?:°C|%|°|K\b|h\b|km\b|m\b|d\b))?)/;
const SPLIT = /^([+−-]?\d[\d,.]*)([\s\S]*)$/;

export function Numbers({ text }: { text: string }) {
  return text.split(NUMBER).map((chunk, i) => {
    if (i % 2 === 0) {
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      return <Fragment key={i}>{chunk}</Fragment>;
    }
    const [, digits, unit] = SPLIT.exec(chunk) ?? [chunk, chunk, ""];
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <span key={i} className="whitespace-nowrap">
        <span className="tabular">{digits}</span>
        {unit}
      </span>
    );
  });
}

/** **bold** + numbers */
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <strong key={i} className="font-medium text-fg">
        <Numbers text={chunk.slice(2, -2)} />
      </strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: static split of an immutable string
      <Numbers key={i} text={chunk} />
    ),
  );
}

/** Safe rendering of LUNA's chat answers: paragraphs, "- " bullets, **bold**, tabular numbers. */
export function LunaRichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="flex list-disc flex-col gap-1 pl-4 marker:text-fg-faint">
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
