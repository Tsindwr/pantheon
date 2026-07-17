import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  getChargeFace,
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
  onPerkColorChange?: (faceValue: number, color: string) => void;
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
const cssLength = (value?: number | string) => (typeof value === "number" ? `${value}px` : value);

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

function getColorInputValue(color?: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#111111";
}

function getPerkDisplayName(perk?: PerkMark): string {
  return perk?.name ?? perk?.label ?? "Perk";
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
  highlighted?: boolean;
  interactive?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: (event: React.MouseEvent<SVGGElement>) => void;
}) {
  const {
    cx,
    cy,
    r,
    active,
    jinxed,
    perk,
    charged,
    explosiveReady,
    highlighted,
    interactive,
    onMouseEnter,
    onMouseLeave,
    onClick,
  } = props;
  const stroke = active
    ? explosiveReady && charged
      ? TOKENS.gold
      : TOKENS.nodeActiveStroke
    : TOKENS.nodeDisabledStroke;

  const fill = jinxed ? TOKENS.jinxFill : TOKENS.paper;
  const opacity = active ? 1 : 0.55;
  const glyphColor = perk?.color ?? TOKENS.ink;
  const isHighlighted = Boolean(active && highlighted);

  return (
    <g
      opacity={opacity}
      onMouseEnter={interactive ? onMouseEnter : undefined}
      onMouseLeave={interactive ? onMouseLeave : undefined}
      onClick={interactive ? onClick : undefined}
      style={{
        cursor: interactive ? "pointer" : "default",
        touchAction: interactive ? "manipulation" : "auto",
      }}
    >
      {isHighlighted ? (
        <circle
          cx={cx}
          cy={cy}
          r={r + 5}
          fill="none"
          stroke={perk?.color ?? TOKENS.purple}
          strokeWidth={2.5}
          opacity={0.8}
        />
      ) : null}

      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={isHighlighted ? 5 : explosiveReady && charged ? 5 : 4}
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

function PerkInfoPopup({
  xPercent,
  yPercent,
  placement,
  perk,
  onOpenColor,
}: {
  xPercent: number;
  yPercent: number;
  placement: "above" | "below";
  perk: PerkMark;
  onOpenColor: () => void;
}) {
  const width = 190;
  const height = 120;
  const gap = 10;
  const top =
    placement === "above"
      ? `calc(${yPercent}% - ${height + gap}px)`
      : `calc(${yPercent}% + ${gap}px)`;
  const name = getPerkDisplayName(perk);
  const description = perk.description ?? "No description available.";

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 30,
        left: `clamp(8px, calc(${xPercent}% - ${width / 2}px), calc(100% - ${width + 8}px))`,
        top: `clamp(8px, ${top}, calc(100% - ${height + 8}px))`,
        width: `min(${width}px, calc(100vw - 24px))`,
        minHeight: height,
        maxHeight: "min(150px, calc(100vh - 40px))",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 10,
        border: "1px solid rgba(210, 178, 76, 0.45)",
        borderRadius: 6,
        background: "linear-gradient(180deg, rgba(18, 22, 31, 0.98), rgba(9, 12, 18, 0.98))",
        boxShadow: "0 14px 32px rgba(0, 0, 0, 0.45), 0 0 18px rgba(107, 76, 230, 0.18)",
        color: "rgba(255, 255, 255, 0.9)",
        fontFamily: "var(--md-text-font, system-ui)",
        lineHeight: 1.25,
        backdropFilter: "blur(8px)",
      }}
    >
      <strong
        style={{
          minHeight: 17,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 13.5,
          color: "var(--sunder-gold, #d2b24c)",
          letterSpacing: "0.02em",
        }}
      >
        {name}
      </strong>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: 4,
          fontSize: 11.5,
          color: "rgba(255, 255, 255, 0.78)",
        }}
      >
        {description}
      </div>
      <button
        type="button"
        aria-label={`Choose icon color for ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenColor();
        }}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          minHeight: 24,
          padding: "3px 7px",
          border: "1px solid rgba(210, 178, 76, 0.45)",
          borderRadius: 5,
          background: "rgba(255, 255, 255, 0.06)",
          color: "rgba(255, 255, 255, 0.86)",
          cursor: "pointer",
          font: "inherit",
          fontSize: 11.5,
          fontWeight: 800,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            border: "1px solid rgba(255, 255, 255, 0.38)",
            background: "conic-gradient(#e04646, #d2b24c, #48a868, #3f88c5, #6b4ce6, #e04646)",
          }}
        />
        Color
      </button>
    </div>
  );
}

function PerkColorModal({
  perkName,
  color,
  onColorChange,
  onApply,
  onClose,
}: {
  perkName: string;
  color: string;
  onColorChange: (color: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 18,
        background: "rgba(17, 17, 17, 0.35)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Choose icon color for ${perkName}`}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(320px, 100%)",
          display: "grid",
          gap: 14,
          padding: 18,
          border: "2px solid var(--sunder-ink, #111111)",
          borderRadius: 8,
          background: "var(--sunder-paper, #ffffff)",
          color: "var(--sunder-ink, #111111)",
          boxShadow: "0 18px 44px rgba(17, 17, 17, 0.28)",
          fontFamily: "var(--md-text-font, system-ui)",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>
            Icon Color
          </div>
          <div style={{ marginTop: 4, fontSize: 14 }}>{perkName}</div>
        </div>

        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 800 }}>
          Color
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
            style={{
              width: "100%",
              height: 44,
              border: "1px solid rgba(17, 17, 17, 0.35)",
              borderRadius: 6,
              background: "transparent",
              cursor: "pointer",
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 11px",
              border: "1px solid rgba(17, 17, 17, 0.35)",
              borderRadius: 6,
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
              fontWeight: 800,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            style={{
              padding: "7px 11px",
              border: "1px solid var(--sunder-ink, #111111)",
              borderRadius: 6,
              background: "var(--sunder-ink, #111111)",
              color: "var(--sunder-paper, #ffffff)",
              cursor: "pointer",
              font: "inherit",
              fontWeight: 900,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
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
  onPerkColorChange,
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

  const [hoveredOuterFace, setHoveredOuterFace] = useState<number | null>(null);
  const [selectedPerkFace, setSelectedPerkFace] = useState<number | null>(null);
  const [localPerkColors, setLocalPerkColors] = useState<Record<number, string>>({});
  const [colorModal, setColorModal] = useState<{ faceValue: number; color: string } | null>(null);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  const activeSlots = clamp(potentialValue, 0, potentialCap);
  const safeResist = clamp(resistance, 0, activeSlots);
  const safeStress = clamp(stress, 0, activeSlots - safeResist);
  const resistStartIndex = activeSlots - safeResist;

  const visibleFaces = getVisibleVolatilityFaces(volatilityDieMax);
  const chargeFace = getChargeFace(volatilityDieMax);
  const displayVolatilityPerks = useMemo(() => {
    const next: Record<number, PerkMark> = { ...volatilityPerks };

    Object.entries(localPerkColors).forEach(([face, color]) => {
      const parsedFace = Number(face);
      if (!Number.isInteger(parsedFace)) return;
      next[parsedFace] = { ...next[parsedFace], color };
    });

    return next;
  }, [localPerkColors, volatilityPerks]);
  // Reserve the first outer node as an intentionally empty slot (perks are not allowed there).
  // To present visible faces starting at the second node, add 1 here so the ring shows
  // a reserved empty node followed by the actual visible faces.
  const outerActiveSlots = clamp(visibleFaces.length, 0, volatilityCap);
  const explosiveReady = isExplosiveReady({ charged, stress: safeStress, volatilityDieMax });
  const chargeColor = displayVolatilityPerks[chargeFace]?.color ?? localPerkColors[chargeFace];

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

  const titleY = cy + size * 0.225;
  const scoreY = cy + 6;
  const readyArcPath = describeArc(cx, cy, outerR, startDeg, endDeg);
  const outerAngles = useMemo(
    () => anglesForArc(volatilityCap, startDeg, endDeg),
    [endDeg, startDeg, volatilityCap],
  );
  const selectedOuterIndex =
    selectedPerkFace === null ? -1 : visibleFaces.indexOf(selectedPerkFace) + 1;
  const selectedPerkPoint =
    selectedOuterIndex > 0 && selectedOuterIndex < outerAngles.length
      ? polar(cx, cy, outerR, outerAngles[selectedOuterIndex])
      : null;
  const selectedPerk = selectedPerkFace
    ? getDisplayedPerkMark({
        faceValue: selectedPerkFace,
        volatilityDieMax,
        charged,
        volatilityPerks: displayVolatilityPerks,
        chargeColor,
      })
    : undefined;
  const colorModalPerk = colorModal
    ? getDisplayedPerkMark({
        faceValue: colorModal.faceValue,
        volatilityDieMax,
        charged,
        volatilityPerks: displayVolatilityPerks,
        chargeColor,
      })
    : undefined;

  const applyPerkColor = useCallback(
    (faceValue: number, color: string) => {
      setLocalPerkColors((prev) => ({ ...prev, [faceValue]: color }));
      onPerkColorChange?.(faceValue, color);
    },
    [onPerkColorChange],
  );

  useEffect(() => {
    if (selectedPerkFace === null) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && widgetRootRef.current?.contains(target)) return;
      setSelectedPerkFace(null);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [selectedPerkFace]);

  const resolvedWidth = cssLength(width);
  const resolvedHeight = height === "auto" ? undefined : cssLength(height);
  const viewPadding = size * 0.045;
  const viewBoxSize = size + viewPadding * 2;
  const toViewPercent = (coordinate: number) =>
    ((coordinate + viewPadding) / viewBoxSize) * 100;
  const selectedPerkPopupPosition = selectedPerkPoint
    ? {
        xPercent: toViewPercent(selectedPerkPoint.x),
        yPercent: toViewPercent(selectedPerkPoint.y),
        placement: selectedPerkPoint.y > size * 0.48 ? ("above" as const) : ("below" as const),
      }
    : null;

  return (
    <div
      ref={widgetRootRef}
      onClick={() => setSelectedPerkFace(null)}
      style={{
        position: "relative",
        display: "block",
        overflow: "visible",
        width: resolvedWidth,
        height: resolvedHeight,
        maxWidth: cssLength(maxWidth),
        maxHeight: cssLength(maxHeight),
        minWidth: cssLength(minWidth),
        minHeight: cssLength(minHeight),
      }}
    >
      <svg
        viewBox={`${-viewPadding} ${-viewPadding} ${viewBoxSize} ${viewBoxSize}`}
        width="100%"
        height={height === "auto" ? undefined : "100%"}
        preserveAspectRatio={preserveAspect}
        aria-label={`${title} potential widget`}
        onClick={() => setSelectedPerkFace(null)}
        style={{
          display: "block",
          background: "transparent",
          width: "100%",
          height: height === "auto" ? "auto" : "100%",
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
                 volatilityPerks: displayVolatilityPerks,
                 chargeColor,
               })
             : undefined;
           const jinxed = faceValue ? isVisibleFaceJinxed(faceValue, safeStress, volatilityDieMax) : false;
           const isChargeFace = faceValue === volatilityDieMax;
           const interactive = Boolean(active && faceValue && perk);

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
               interactive={interactive}
               highlighted={Boolean(faceValue && (hoveredOuterFace === faceValue || selectedPerkFace === faceValue))}
               onMouseEnter={() => {
                 if (faceValue) setHoveredOuterFace(faceValue);
               }}
               onMouseLeave={() => {
                 if (faceValue) {
                   setHoveredOuterFace((current) => (current === faceValue ? null : current));
                 }
               }}
               onClick={(event) => {
                 event.stopPropagation();
                 if (!faceValue || !perk) return;
                 setSelectedPerkFace((current) => (current === faceValue ? null : faceValue));
               }}
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
          const toggleNode =
            isLeftmostActive && isRightmostActive
              ? state === "resistance"
                ? toggleResistFromRightmost
                : toggleStressFromLeftmost
              : isLeftmostActive
                ? toggleStressFromLeftmost
                : isRightmostActive
                  ? toggleResistFromRightmost
                  : undefined;

          return (
            <PotentialTrackNode
              cx={p.x}
              cy={p.y}
              r={innerNodeR}
              state={state}
              interactive={Boolean(onChange && (isLeftmostActive || isRightmostActive))}
              onClick={toggleNode}
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
        fontSize={size * 0.078}
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

      {selectedPerkPopupPosition && selectedPerk ? (
        <PerkInfoPopup
          xPercent={selectedPerkPopupPosition.xPercent}
          yPercent={selectedPerkPopupPosition.yPercent}
          placement={selectedPerkPopupPosition.placement}
          perk={selectedPerk}
          onOpenColor={() => {
            if (!selectedPerkFace) return;
            setColorModal({
              faceValue: selectedPerkFace,
              color: getColorInputValue(selectedPerk.color),
            });
          }}
        />
      ) : null}

      {colorModal ? (
        <PerkColorModal
          perkName={getPerkDisplayName(colorModalPerk)}
          color={colorModal.color}
          onColorChange={(color) =>
            setColorModal((current) => (current ? { ...current, color } : current))
          }
          onClose={() => setColorModal(null)}
          onApply={() => {
            applyPerkColor(colorModal.faceValue, colorModal.color);
            setColorModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
