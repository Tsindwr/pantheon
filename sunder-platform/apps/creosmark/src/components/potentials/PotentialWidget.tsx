import React, { useCallback, useMemo, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  getDisplayedPerkMark,
  getVisibleVolatilityFaces,
  isExplosiveReady,
  isVisibleFaceJinxed,
  type PerkMark,
} from "../../lib/volatility.ts";

export type PotentialWidgetProps = {
  title: string;
  potentialValue: number;
  stress: number;
  resistance: number;
  volatilityDieMax: number;
  volatilityPerks?: Record<number, PerkMark>;
  charged?: boolean;
  onChange?: (next: { stress: number; resistance: number }) => void;
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number | string;
  maxHeight?: number | string;
  potentialCap?: number;
  volatilityCap?: number;
  startDeg?: number;
  endDeg?: number;
  designSize?: number;
  preserveAspect?: "xMidYMid meet" | "xMidYMid slice" | "none";
};

const TOKENS = {
  ink: "var(--sunder-ink, #111111)",
  purple: "var(--sunder-purple, #6b4ce6)",
  gold: "var(--sunder-gold, #d2b24c)",
  paper: "var(--sunder-paper, #ffffff)",
  nodeActiveStroke: "var(--sunder-node-active, #111111)",
  nodeDisabledStroke: "var(--sunder-node-disabled, #b8b8b8)",
  stressFill: "var(--sunder-stress-fill, #6b4ce6)",
  resistFill: "var(--sunder-resist-fill, #d2b24c)",
  connectorActive: "var(--sunder-connector, #111111)",
  connectorDisabled: "var(--sunder-connector-disabled, #9e9e9e)",
  jinxFill: "var(--sunder-jinx-fill, #d9d9d9)",
  whiteOutline: "#ffffff",
};

type Point = { x: number; y: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const degToRad = (deg: number) => (deg * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, deg: number): Point {
  const a = degToRad(deg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function anglesForArc(count: number, startDeg: number, endDeg: number): number[] {
  if (count <= 1) return [startDeg];

  const end = endDeg < startDeg ? endDeg + 360 : endDeg;
  const step = (end - startDeg) / (count - 1);

  return Array.from({ length: count }, (_, i) => startDeg + step * i);
}

function shortenSegment(a: Point, b: Point, shrink: number): { a: Point; b: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    a: { x: a.x + ux * shrink, y: a.y + uy * shrink },
    b: { x: b.x - ux * shrink, y: b.y - uy * shrink },
  };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const end = endDeg < startDeg ? endDeg + 360 : endDeg;
  const start = polar(cx, cy, r, startDeg);
  const finish = polar(cx, cy, r, end);
  const largeArcFlag = end - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${finish.x} ${finish.y}`;
}

function useLongPress(thresholdMs = 450) {
  const timer = useRef<number | null>(null);
  const [fired, setFired] = useState(false);

  const start = useCallback(
    (fn: () => void) => {
      setFired(false);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setFired(true);
        fn();
      }, thresholdMs);
    },
    [thresholdMs],
  );

  const cancel = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  return { start, cancel, fired };
}

function FaIconGlyph({
  icon,
  cx,
  cy,
  sizePx,
  color,
}: {
  icon: IconDefinition;
  cx: number;
  cy: number;
  sizePx: number;
  color: string;
}) {
  const [w, h, , , svgPathData] = icon.icon;
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const scale = sizePx / Math.max(w, h);
  const strokeWidth = 1.4 / scale;

  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-w / 2} ${-h / 2})`}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={color}
          stroke={TOKENS.whiteOutline}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ paintOrder: "stroke fill" } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

function PotentialTrackNode(props: {
  cx: number;
  cy: number;
  r: number;
  state: "disabled" | "empty" | "stress" | "resistance";
  interactive?: boolean;
  onClick?: () => void;
}) {
  const { cx, cy, r, state, interactive, onClick } = props;
  const disabled = state === "disabled";
  const stroke = disabled ? TOKENS.nodeDisabledStroke : TOKENS.nodeActiveStroke;

  const fill =
    state === "stress"
      ? TOKENS.stressFill
      : state === "resistance"
        ? TOKENS.resistFill
        : TOKENS.paper;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={4}
      opacity={disabled ? 0.55 : 1}
      onClick={interactive ? onClick : undefined}
      style={{
        cursor: interactive ? "pointer" : "default",
        touchAction: interactive ? "manipulation" : "auto",
      }}
    />
  );
}

function VolatilityPerkNode(props: {
  cx: number;
  cy: number;
  r: number;
  active: boolean;
  jinxed: boolean;
  perk?: PerkMark;
  charged?: boolean;
  explosiveReady?: boolean;
}) {
  const { cx, cy, r, active, jinxed, perk, charged, explosiveReady } = props;
  const stroke = active
    ? explosiveReady && charged
      ? TOKENS.gold
      : TOKENS.nodeActiveStroke
    : TOKENS.nodeDisabledStroke;

  const fill = jinxed ? TOKENS.jinxFill : TOKENS.paper;
  const opacity = active ? 1 : 0.55;
  const glyphColor = perk?.color ?? TOKENS.ink;

  return (
    <g opacity={opacity}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={explosiveReady && charged ? 5 : 4}
        style={
          explosiveReady && charged
            ? { filter: "drop-shadow(0 0 8px rgba(210, 178, 76, 0.4))" }
            : undefined
        }
      />

      {perk?.icon ? (
        <FaIconGlyph icon={perk.icon} cx={cx} cy={cy} sizePx={r * 1.25} color={glyphColor} />
      ) : perk?.label ? (
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(9, r * 0.95)}
          fill={glyphColor}
          stroke={TOKENS.whiteOutline}
          strokeWidth={1.5}
          strokeLinejoin="round"
          style={{
            paintOrder: "stroke fill",
            fontFamily: "var(--md-text-font, system-ui)",
            fontWeight: 900,
          }}
        >
          {perk.label}
        </text>
      ) : null}
    </g>
  );
}

function ArcTrack(props: {
  center: Point;
  radius: number;
  count: number;
  startDeg: number;
  endDeg: number;
  connect?: boolean;
  connectorShrink?: number;
  connectorWidth?: number;
  connectorStyle?: (segmentIndex: number) => { stroke: string; opacity?: number };
  renderNode: (args: { index: number; deg: number; p: Point }) => React.ReactNode;
}) {
  const {
    center,
    radius,
    count,
    startDeg,
    endDeg,
    connect = false,
    connectorShrink = 14,
    connectorWidth = 8,
    connectorStyle,
    renderNode,
  } = props;

  const angles = useMemo(() => anglesForArc(count, startDeg, endDeg), [count, startDeg, endDeg]);
  const points = useMemo(
    () => angles.map((deg) => polar(center.x, center.y, radius, deg)),
    [angles, center.x, center.y, radius],
  );

  return (
    <g>
      {connect
        ? points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1];
            const seg = shortenSegment(p1, p2, connectorShrink);
            const style = connectorStyle?.(i) ?? { stroke: TOKENS.connectorActive, opacity: 0.9 };

            return (
              <line
                key={`seg-${i}`}
                x1={seg.a.x}
                y1={seg.a.y}
                x2={seg.b.x}
                y2={seg.b.y}
                stroke={style.stroke}
                strokeWidth={connectorWidth}
                strokeLinecap="round"
                opacity={style.opacity ?? 0.9}
                pointerEvents="none"
              />
            );
          })
        : null}

      {points.map((p, index) => (
        <g key={`node-${index}`}>{renderNode({ index, deg: angles[index], p })}</g>
      ))}
    </g>
  );
}

export default function PotentialWidget({
  title,
  potentialValue,
  stress,
  resistance,
  volatilityDieMax,
  volatilityPerks = {},
  charged,
  onChange,
  potentialCap = 12,
  volatilityCap = 12,
  startDeg = 150,
  endDeg = 30,
  width = "100%",
  height = "auto",
  maxWidth,
  maxHeight,
  minWidth,
  minHeight,
  designSize = 420,
  preserveAspect = "xMidYMid meet",
}: PotentialWidgetProps) {
  const size = designSize;
  const cx = size / 2;
  const cy = size * 0.46;
  const center: Point = { x: cx, y: cy };

  const innerNodeR = size * 0.036;
  const outerNodeR = size * 0.045;
  const innerR = size * 0.28;
  const outerR = innerR + innerNodeR + outerNodeR + size * 0.06;

  const activeSlots = clamp(potentialValue, 0, potentialCap);
  const safeResist = clamp(resistance, 0, activeSlots);
  const safeStress = clamp(stress, 0, activeSlots - safeResist);
  const resistStartIndex = activeSlots - safeResist;

  const visibleFaces = getVisibleVolatilityFaces(volatilityDieMax);
  // Reserve the first outer node as an intentionally empty slot (perks are not allowed there).
  // To present visible faces starting at the second node, add 1 here so the ring shows
  // a reserved empty node followed by the actual visible faces.
  const outerActiveSlots = clamp(visibleFaces.length, 0, volatilityCap);
  const explosiveReady = isExplosiveReady({ charged, stress: safeStress, volatilityDieMax });

  const commit = useCallback(
    (next: { stress: number; resistance: number }) => {
      onChange?.(next);
    },
    [onChange],
  );

  const addStress = useCallback(() => {
    if (!onChange) return;
    if (safeStress + safeResist >= activeSlots) return;
    commit({ stress: safeStress + 1, resistance: safeResist });
  }, [onChange, safeStress, safeResist, activeSlots, commit]);

  const addResistance = useCallback(() => {
    if (!onChange) return;
    if (safeStress + safeResist >= activeSlots) return;
    commit({ stress: safeStress, resistance: safeResist + 1 });
  }, [onChange, safeStress, safeResist, activeSlots, commit]);

  const toggleStressFromLeftmost = useCallback(() => {
    if (!onChange) return;
    if (safeStress === 0) {
      if (safeResist >= activeSlots) return;
      commit({ stress: 1, resistance: safeResist });
    } else {
      commit({ stress: safeStress - 1, resistance: safeResist });
    }
  }, [onChange, safeStress, safeResist, activeSlots, commit]);

  const toggleResistFromRightmost = useCallback(() => {
    if (!onChange) return;
    if (safeResist === 0) {
      if (safeStress >= activeSlots) return;
      commit({ stress: safeStress, resistance: 1 });
    } else {
      commit({ stress: safeStress, resistance: safeResist - 1 });
    }
  }, [onChange, safeStress, safeResist, activeSlots, commit]);

  const { start: startLongPress, cancel: cancelLongPress, fired } = useLongPress(450);

  const titleY = size - 44;
  const scoreY = cy + 6;
  const readyArcPath = describeArc(cx, cy, outerR, startDeg, endDeg);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={typeof width === "number" ? `${width}px` : width}
      height={height === "auto" ? undefined : typeof height === "number" ? `${height}px` : height}
      preserveAspectRatio={preserveAspect}
      aria-label={`${title} potential widget`}
      style={{
        display: "block",
        background: "transparent",
        width: typeof width === "number" ? `${width}px` : width,
        height: height === "auto" ? "auto" : typeof height === "number" ? `${height}px` : height,
        maxWidth: maxWidth ? (typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth) : undefined,
        maxHeight: maxHeight ? (typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight) : undefined,
        minWidth: minWidth ? (typeof minWidth === "number" ? `${minWidth}px` : minWidth) : undefined,
        minHeight: minHeight ? (typeof minHeight === "number" ? `${minHeight}px` : minHeight) : undefined,
      }}
    >
      {explosiveReady ? (
        <path
          d={readyArcPath}
          fill="none"
          stroke={TOKENS.gold}
          strokeWidth={outerNodeR * 0.78}
          strokeLinecap="round"
          opacity={0.55}
          style={{ filter: "drop-shadow(0 0 10px rgba(210, 178, 76, 0.4))" }}
        />
      ) : null}

      <ArcTrack
        center={center}
        radius={outerR}
        count={volatilityCap}
        startDeg={startDeg}
        endDeg={endDeg}
        connect={false}
        renderNode={({ index, p }) => {
          const active = index < outerActiveSlots;
          // The first outer node (index 0) is reserved and must remain empty. Map visibleFaces
          // to nodes starting at index 1 by looking up visibleFaces[index - 1] when index > 0.
          const faceValue = active && index > 0 ? visibleFaces[index - 1] : undefined;
           const perk = faceValue
             ? getDisplayedPerkMark({
                 faceValue,
                 volatilityDieMax,
                 charged,
                 volatilityPerks,
               })
             : undefined;
           const jinxed = faceValue ? isVisibleFaceJinxed(faceValue, safeStress, volatilityDieMax) : false;
           const isChargeFace = faceValue === volatilityDieMax;

           return (
             <VolatilityPerkNode
               cx={p.x}
               cy={p.y}
               r={outerNodeR}
               active={active}
               jinxed={active && jinxed}
               perk={perk}
               charged={isChargeFace && Boolean(charged)}
               explosiveReady={explosiveReady}
             />
           );
         }}
      />

      <ArcTrack
        center={center}
        radius={innerR}
        count={potentialCap}
        startDeg={startDeg}
        endDeg={endDeg}
        connect
        connectorWidth={innerNodeR * 0.55}
        connectorShrink={innerNodeR + 3}
        connectorStyle={(segIndex) => {
          const aEnabled = segIndex < activeSlots;
          const bEnabled = segIndex + 1 < activeSlots;
          return aEnabled && bEnabled
            ? { stroke: TOKENS.connectorActive, opacity: 0.92 }
            : { stroke: TOKENS.connectorDisabled, opacity: 0.55 };
        }}
        renderNode={({ index, p }) => {
          const isEnabled = index < activeSlots;
          let state: "disabled" | "empty" | "stress" | "resistance" = "disabled";
          if (isEnabled) {
            const isStress = index < safeStress;
            const isResist = index >= resistStartIndex;
            state = isStress ? "stress" : isResist ? "resistance" : "empty";
          }

          const isLeftmostActive = isEnabled && index === 0;
          const isRightmostActive = isEnabled && index === activeSlots - 1;

          return (
            <PotentialTrackNode
              cx={p.x}
              cy={p.y}
              r={innerNodeR}
              state={state}
              interactive={Boolean(onChange && (isLeftmostActive || isRightmostActive))}
              onClick={
                isLeftmostActive
                  ? toggleStressFromLeftmost
                  : isRightmostActive
                    ? toggleResistFromRightmost
                    : undefined
              }
            />
          );
        }}
      />

      <g
        style={{ cursor: onChange ? "pointer" : "default", touchAction: "manipulation" }}
        onPointerDown={(e) => {
          if (!onChange) return;
          (e.currentTarget as SVGGElement).setPointerCapture?.(e.pointerId);
          startLongPress(() => addResistance());
        }}
        onPointerUp={() => {
          if (!onChange) return;
          cancelLongPress();
          if (!fired) addStress();
        }}
        onPointerCancel={() => cancelLongPress()}
      >
        <circle cx={cx} cy={scoreY} r={size * 0.18} fill="transparent" />
        <text
          x={cx}
          y={scoreY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.23}
          fill={TOKENS.gold}
          style={{
            fontFamily: "var(--md-text-font, system-ui)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            userSelect: "none",
          }}
        >
          {activeSlots}
        </text>
      </g>

      {explosiveReady ? (
        <text
          x={cx}
          y={scoreY + size * 0.145}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.04}
          fill={TOKENS.gold}
          style={{ fontFamily: "var(--md-text-font, system-ui)", fontWeight: 800, letterSpacing: "0.08em" }}
        >
          CHARGED
        </text>
      ) : null}

      <text
        x={cx}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.085}
        fill={explosiveReady ? TOKENS.gold : TOKENS.purple}
        style={{
          fontFamily: "var(--md-text-font, system-ui)",
          fontWeight: 900,
          letterSpacing: "0.08em",
          userSelect: "none",
        }}
      >
        {title.toUpperCase()}
      </text>
    </svg>
  );
}
