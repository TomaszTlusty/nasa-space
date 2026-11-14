import { cn } from "@/lib/cn";

/* Idle blink every ~5 s; removed entirely for reduced motion (a 1 ms infinite loop would flicker). */
const BLINK_CSS = `
.luna-eyes { transform-box: fill-box; transform-origin: center; animation: luna-blink 5.2s infinite; }
@keyframes luna-blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.12); } }
@media (prefers-reduced-motion: reduce) { .luna-eyes { animation: none; } }
`;

/** LUNA-Bot: a small tracked rover with a visor, drawn as line art in the current text colour. */
export function LunaBot({ className }: { className?: string }) {
  return (
    <>
      <style href="luna-bot-blink" precedence="default">
        {BLINK_CSS}
      </style>
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-7", className)}>
        <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          {/* antenna */}
          <path d="M16 8V5" />
          {/* head */}
          <rect x={7} y={8} width={18} height={12.5} rx={4.5} />
          {/* visor */}
          <rect x={10} y={11.25} width={12} height={6} rx={3} className="fill-white/6" strokeWidth={1.1} />
          {/* neck struts */}
          <path d="M12.5 20.5 11.5 23.5M19.5 20.5l1 3" />
          {/* tread */}
          <rect x={6} y={23.5} width={20} height={5} rx={2.5} />
        </g>
        <circle cx={16} cy={3.75} r={1.35} className="fill-sun" />
        <g className="luna-eyes fill-fg">
          <circle cx={13.5} cy={14.25} r={1.15} />
          <circle cx={18.5} cy={14.25} r={1.15} />
        </g>
        <g className="fill-current opacity-60">
          <circle cx={10} cy={26} r={0.9} />
          <circle cx={16} cy={26} r={0.9} />
          <circle cx={22} cy={26} r={0.9} />
        </g>
      </svg>
    </>
  );
}
