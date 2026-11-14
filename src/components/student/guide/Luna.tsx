"use client";

import { motion, type Transition, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { LUNA_COLORS as C, type Mood } from "./moods";

/**
 * LUNA, the Student-mode mascot: a little astronaut robot with a dark visor for a face. Every mood is a set of
 * shape targets (eye size, eyelid edge, mouth curve, arm pose) that springs into place, so changing mood morphs
 * instead of swapping drawings. Reduced motion: no float, blink, shiver, eye-follow or talking; moods snap.
 *
 * Coordinates are in a 120 × 120 box: helmet centre (60, 56) r 36, visor centre (60, 58), eyes at y 54.
 */

const EYE_Y = 54;
const EYE_X = [50, 70] as const;

interface Face {
  /** eye radii and vertical offset */
  rx: number;
  ry: number;
  dy: number;
  /** eyelid bottom edge relative to the eye centre, at the eye's outer and inner side (negative = above) */
  lidOuter: number;
  lidInner: number;
  /** "^ ^" smiling eyes instead of round ones */
  arc: boolean;
  /** mouth: quadratic curve with the same command structure for every mood, so it morphs */
  mouth: string;
  /** "o" mouth instead of the curve */
  oMouth: boolean;
  blush: number;
  /** hand positions (the arms are lines from fixed shoulders) */
  handL: [number, number];
  handR: [number, number];
}

const OPEN = -12;

const FACES: Record<Mood, Face> = {
  idle: {
    rx: 5,
    ry: 6.5,
    dy: 0,
    lidOuter: OPEN,
    lidInner: OPEN,
    arc: false,
    mouth: "M54 66 Q60 70.5 66 66",
    oMouth: false,
    blush: 0.3,
    handL: [36, 104],
    handR: [84, 104],
  },
  happy: {
    rx: 5,
    ry: 6.5,
    dy: 0,
    lidOuter: OPEN,
    lidInner: OPEN,
    arc: true,
    mouth: "M52 65 Q60 73.5 68 65",
    oMouth: false,
    blush: 0.6,
    handL: [33, 99],
    handR: [87, 99],
  },
  excited: {
    rx: 5.6,
    ry: 7.6,
    dy: -0.5,
    lidOuter: OPEN,
    lidInner: OPEN,
    arc: false,
    mouth: "M51 64.5 Q60 76 69 64.5",
    oMouth: false,
    blush: 0.6,
    handL: [24, 76],
    handR: [96, 76],
  },
  worried: {
    rx: 5,
    ry: 6.5,
    dy: 0.5,
    lidOuter: -1.5,
    lidInner: -6.5,
    arc: false,
    mouth: "M55 68.5 Q60 65.5 65 68.5",
    oMouth: false,
    blush: 0,
    handL: [52, 102],
    handR: [68, 102],
  },
  cold: {
    rx: 5,
    ry: 4.2,
    dy: 1,
    lidOuter: -1.8,
    lidInner: -1.8,
    arc: false,
    mouth: "M54.5 68 Q60 68 65.5 68",
    oMouth: false,
    blush: 0,
    handL: [57, 100],
    handR: [63, 100],
  },
  sad: {
    rx: 4.8,
    ry: 5.6,
    dy: 1.5,
    lidOuter: 0.5,
    lidInner: -4.5,
    arc: false,
    mouth: "M54 69.5 Q60 64.5 66 69.5",
    oMouth: false,
    blush: 0,
    handL: [41, 107],
    handR: [79, 107],
  },
  amazed: {
    rx: 6.2,
    ry: 8.4,
    dy: -1,
    lidOuter: OPEN,
    lidInner: OPEN,
    arc: false,
    mouth: "M56 67 Q60 68 64 67",
    oMouth: true,
    blush: 0.35,
    handL: [31, 94],
    handR: [89, 94],
  },
  thinking: {
    rx: 4.8,
    ry: 6,
    dy: 0,
    lidOuter: OPEN,
    lidInner: -3,
    arc: false,
    mouth: "M56 67.5 Q61 69.5 65.5 66",
    oMouth: false,
    blush: 0.2,
    handL: [36, 104],
    handR: [69, 84],
  },
};

const SHOULDER_L: [number, number] = [45, 94];
const SHOULDER_R: [number, number] = [75, 94];

export interface LunaProps {
  mood: Mood;
  /** mouth moves while a message is being revealed */
  talking?: boolean;
  /** live mascot (float, eye-follow); false for the small chat avatar */
  lively?: boolean;
  className?: string;
}

export function Luna({ mood, talking = false, lively = true, className }: LunaProps) {
  const reduce = useReducedMotion() ?? false;
  const face = FACES[mood];
  const id = useId();
  const visorClip = `${id}-visor`;
  const svgRef = useRef<SVGSVGElement>(null);

  const morph: Transition = reduce ? { duration: 0 } : { type: "spring", bounce: 0, visualDuration: 0.28 };

  // Eyes glance toward the pointer (springs, no overshoot); look up while thinking.
  const lookX = useSpring(0, { bounce: 0, visualDuration: 0.3 });
  const lookY = useSpring(0, { bounce: 0, visualDuration: 0.3 });
  const follow = lively && !reduce;
  useEffect(() => {
    if (mood === "thinking") {
      lookX.set(1.2);
      lookY.set(-2.6);
      return;
    }
    lookX.set(0);
    lookY.set(0);
    if (!follow) return;
    const onMove = (e: PointerEvent) => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / 320;
      const dy = (e.clientY - (r.top + r.height * 0.45)) / 320;
      lookX.set(Math.max(-1, Math.min(1, dx)) * 2.4);
      lookY.set(Math.max(-1, Math.min(1, dy)) * 1.8);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [follow, mood, lookX, lookY]);

  // Blink at random 2.4–6 s intervals.
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(
        () => {
          setBlink(true);
          t = window.setTimeout(() => {
            setBlink(false);
            schedule();
          }, 120);
        },
        2400 + Math.random() * 3600,
      );
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [reduce]);

  const lid = (cx: number, side: 1 | -1) => {
    // side = -1 for the left eye (outer edge on the left), 1 for the right eye
    const yL = EYE_Y + face.dy + (side === -1 ? face.lidOuter : face.lidInner);
    const yR = EYE_Y + face.dy + (side === -1 ? face.lidInner : face.lidOuter);
    return `M${cx - 9} ${EYE_Y - 22} L${cx + 9} ${EYE_Y - 22} L${cx + 9} ${yR} L${cx - 9} ${yL} Z`;
  };

  const arm = (s: [number, number], h: [number, number]) => `M${s[0]} ${s[1]} L${h[0]} ${h[1]}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("overflow-visible", className)}
    >
      <defs>
        <clipPath id={visorClip}>
          <ellipse cx={60} cy={58} rx={27} ry={21} />
        </clipPath>
      </defs>

      <motion.g
        animate={lively && !reduce ? { y: [0, -2.6, 0] } : { y: 0 }}
        transition={lively && !reduce ? { duration: 2.8, ease: "easeInOut", repeat: Infinity } : { duration: 0 }}
      >
        <motion.g
          animate={mood === "cold" && !reduce ? { x: [0, -0.9, 0.9, -0.7, 0.7, 0] } : { x: 0 }}
          transition={
            mood === "cold" && !reduce
              ? { duration: 0.42, repeat: Infinity, repeatDelay: 0.9, ease: "linear" }
              : { duration: 0.15 }
          }
        >
          {/* backpack + body */}
          <rect x={36} y={84} width={48} height={25} rx={10} fill={C.pack} />
          <rect x={42} y={86} width={36} height={26} rx={12} fill={C.shell} />
          <rect x={42} y={86} width={36} height={26} rx={12} stroke={C.shellShade} strokeWidth={1} />
          <rect x={52.5} y={95} width={15} height={9} rx={3.5} fill={C.lilac} />
          <circle cx={57} cy={99.5} r={1.6} fill={C.earth} />
          <circle cx={63} cy={99.5} r={1.6} fill={C.sun} />

          {/* antenna */}
          <path d="M60 21 Q58.5 14 63 9.5" stroke={C.shellShade} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={63.5} cy={8.5} r={3.6} fill={C.sun} />
          <circle cx={62.4} cy={7.4} r={1.1} fill="oklch(1 0 0 / 0.7)" />

          {/* ear pods (suit trim) */}
          <rect x={20} y={48} width={8} height={17} rx={4} fill={C.lilac} />
          <rect x={92} y={48} width={8} height={17} rx={4} fill={C.lilac} />

          {/* helmet */}
          <circle cx={60} cy={56} r={36} fill={C.shell} />
          <path d="M28 66 A36 36 0 0 0 92 66 A40 40 0 0 1 28 66 Z" fill={C.shellShade} opacity={0.55} />
          <ellipse cx={60} cy={58} rx={29.5} ry={23.5} fill={C.lilac} />
          <ellipse cx={60} cy={58} rx={27} ry={21} fill={C.visor} />

          {/* face, clipped to the visor */}
          <g clipPath={`url(#${visorClip})`}>
            {/* cheeks */}
            {[44, 76].map((cx) => (
              <motion.ellipse
                key={cx}
                cx={cx}
                cy={64}
                rx={3.6}
                ry={2.1}
                fill={C.blush}
                initial={false}
                animate={{ opacity: face.blush }}
                transition={morph}
              />
            ))}

            {/* eyes */}
            <motion.g style={{ x: lookX, y: lookY }}>
              <motion.g
                initial={false}
                animate={{ scaleY: blink ? 0.1 : 1 }}
                transition={{ duration: 0.07 }}
                style={{ originY: 0.5 }}
              >
                {EYE_X.map((cx) => (
                  <g key={cx}>
                    <motion.g initial={false} animate={{ opacity: face.arc ? 0 : 1 }} transition={{ duration: 0.12 }}>
                      <motion.ellipse
                        cx={cx}
                        fill={C.eye}
                        opacity={0.22}
                        initial={false}
                        animate={{ cy: EYE_Y + face.dy, rx: face.rx + 2.6, ry: face.ry + 2.6 }}
                        transition={morph}
                      />
                      <motion.ellipse
                        cx={cx}
                        fill={C.eye}
                        initial={false}
                        animate={{ cy: EYE_Y + face.dy, rx: face.rx, ry: face.ry }}
                        transition={morph}
                      />
                      <motion.circle
                        fill="oklch(1 0 0 / 0.9)"
                        initial={false}
                        animate={{
                          cx: cx + face.rx * 0.36,
                          cy: EYE_Y + face.dy - face.ry * 0.38,
                          r: mood === "excited" || mood === "amazed" ? 1.8 : 1.3,
                        }}
                        transition={morph}
                      />
                    </motion.g>
                    <motion.path
                      d={`M${cx - 5} ${EYE_Y + 1.5} Q${cx} ${EYE_Y - 6} ${cx + 5} ${EYE_Y + 1.5}`}
                      stroke={C.eye}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      initial={false}
                      animate={{ opacity: face.arc ? 1 : 0 }}
                      transition={{ duration: 0.12 }}
                    />
                  </g>
                ))}
              </motion.g>
            </motion.g>

            {/* eyelids: visor-coloured shapes whose bottom edge tilts for worried / sad / sleepy-cold eyes */}
            {EYE_X.map((cx, i) => (
              <motion.path
                key={cx}
                fill={C.visor}
                initial={false}
                animate={{ d: lid(cx, i === 0 ? -1 : 1) }}
                transition={morph}
              />
            ))}

            {/* cold: frost tint */}
            <motion.ellipse
              cx={60}
              cy={58}
              rx={27}
              ry={21}
              fill={C.ice}
              initial={false}
              animate={{ opacity: mood === "cold" ? 0.16 : 0 }}
              transition={{ duration: 0.25 }}
            />

            {/* mouth */}
            <motion.path
              stroke={C.eye}
              strokeWidth={2.2}
              strokeLinecap="round"
              initial={false}
              animate={{ d: face.mouth, opacity: face.oMouth || (talking && !reduce) ? 0 : 1 }}
              transition={morph}
            />
            <motion.ellipse
              cx={60}
              cy={67.5}
              fill={C.eye}
              initial={false}
              animate={
                talking && !reduce
                  ? { opacity: 1, rx: 3, ry: [1.1, 3, 1.5, 2.6, 1.1] }
                  : { opacity: face.oMouth ? 1 : 0, rx: 2.8, ry: face.oMouth ? 3.8 : 1 }
              }
              transition={
                talking && !reduce
                  ? { ry: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.1 } }
                  : morph
              }
            />

            {/* glossy visor highlight */}
            <path d="M40 48 Q46 39 57 38" stroke="oklch(1 0 0 / 0.22)" strokeWidth={2.4} strokeLinecap="round" />
          </g>

          {/* frost crystals on the visor rim */}
          <motion.g
            stroke={C.ice}
            strokeWidth={1.2}
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: mood === "cold" ? 0.95 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <path d="M38 47 l5 0 M40.5 44.5 l0 5 M38.8 45.3 l3.4 3.4 M42.2 45.3 l-3.4 3.4" />
            <path d="M79 70 l4 0 M81 68 l0 4 M79.6 68.6 l2.8 2.8 M82.4 68.6 l-2.8 2.8" />
            <path d="M47 76 l3 0 M48.5 74.5 l0 3" />
          </motion.g>

          {/* arms with lilac gloves (drawn over the helmet edge so a hand can reach the chin) */}
          {(
            [
              [SHOULDER_L, face.handL],
              [SHOULDER_R, face.handR],
            ] as const
          ).map(([s, h]) => (
            <g key={s[0]}>
              <motion.path
                stroke={C.shellShade}
                strokeWidth={9}
                strokeLinecap="round"
                initial={false}
                animate={{ d: arm(s, h) }}
                transition={morph}
              />
              <motion.path
                stroke={C.shell}
                strokeWidth={7}
                strokeLinecap="round"
                initial={false}
                animate={{ d: arm(s, h) }}
                transition={morph}
              />
              <motion.circle
                r={4}
                fill={C.lilacDeep}
                initial={false}
                animate={{ cx: h[0], cy: h[1] }}
                transition={morph}
              />
            </g>
          ))}

          {/* thinking dots */}
          {[
            [94, 24, 2],
            [101, 17, 2.6],
            [109, 9, 3.2],
          ].map(([cx, cy, r], i) => (
            <motion.circle
              key={cx}
              cx={cx}
              cy={cy}
              r={r}
              fill={C.lilac}
              initial={false}
              animate={mood === "thinking" ? (reduce ? { opacity: 1 } : { opacity: [0.25, 1, 0.25] }) : { opacity: 0 }}
              transition={
                mood === "thinking" && !reduce
                  ? { duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }
                  : { duration: 0.15 }
              }
            />
          ))}
        </motion.g>
      </motion.g>
    </svg>
  );
}
