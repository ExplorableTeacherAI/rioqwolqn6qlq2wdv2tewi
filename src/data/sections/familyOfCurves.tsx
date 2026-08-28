/**
 * Section 4 — EXPLORE: "The Family of Curves"
 *
 * A LINKED PAIR (one case ↔ many cases / concrete ↔ abstract):
 *   View A — the stack of curves y = x² + C, with the active one draggable.
 *   View B — the steepness graph y' = 2x, which never moves however far the
 *            stack is shifted.
 * Both views read `familyShift`, `familyX` and `familyHighlight` from the
 * store; the shared x-axis mapping is the visible tie.
 */

import React, { useRef, useState, type ReactElement } from "react";
import { SplitLayout, StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, remap, useSpring, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
} from "../variables";

// ── Domain model ─────────────────────────────────────────────────────────────

const MIN_SHIFT = -2;
const MAX_SHIFT = 3;
const SHIFT_STEP = 0.5;
const MIN_X = -2;
const MAX_X = 2;
const DEFAULT_SHIFT = 0;
const DEFAULT_X = 1;

const curveValue = (x: number, shift: number) => x * x + shift;
const slopeValue = (x: number) => 2 * x;

/** One formatter per quantity — figure, readouts and prose all use these. */
const formatShift = (value: number) => value.toFixed(1);
const formatSlope = (value: number) => value.toFixed(1);

// ── Shared view geometry — THE VISIBLE TIE ───────────────────────────────────
// Both figures use the same viewBox and the same x mapping, so a given x sits
// at the same pixel column in both drawings.

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 310;
const PLOT_LEFT = 48;
const PLOT_RIGHT = 336;
const PLOT_TOP = 44;
const PLOT_BOTTOM = 258;
const X_MIN = -2.4;
const X_MAX = 2.4;

const CURVE_Y_MIN = -2.5;
const CURVE_Y_MAX = 6.5;
const SLOPE_Y_MIN = -5;
const SLOPE_Y_MAX = 5;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD"; // the curve you move (the constant C)
const PARTNER = "#8E90F5"; // the steepness — the quantity tracked in both views

const xToScreen = (x: number) => remap(x, X_MIN, X_MAX, PLOT_LEFT, PLOT_RIGHT);
const screenToX = (px: number) => remap(px, PLOT_LEFT, PLOT_RIGHT, X_MIN, X_MAX);
const curveToScreen = (value: number) =>
    remap(value, CURVE_Y_MIN, CURVE_Y_MAX, PLOT_BOTTOM, PLOT_TOP);
const screenToCurve = (py: number) =>
    remap(py, PLOT_BOTTOM, PLOT_TOP, CURVE_Y_MIN, CURVE_Y_MAX);
const slopeToScreen = (value: number) =>
    remap(value, SLOPE_Y_MIN, SLOPE_Y_MAX, PLOT_BOTTOM, PLOT_TOP);

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── Shared highlight contract (target pops, everything else recedes) ─────────

const useHighlightState = () => {
    const highlight = useVar<string>("familyHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("familyHighlight", id),
            onPointerLeave: () => setVar("familyHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

// ── Shared axis furniture ────────────────────────────────────────────────────

function XAxisLabels({ opacity }: { opacity: number }) {
    return (
        <g opacity={opacity} style={EASE_150}>
            {[-2, -1, 0, 1, 2].map((tick) => (
                <text
                    key={tick}
                    x={xToScreen(tick)}
                    y={278}
                    fontSize="11"
                    fill={INK_STRUCTURE}
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {tick}
                </text>
            ))}
        </g>
    );
}

// ── VIEW A: the stack of curves ──────────────────────────────────────────────

function CurveFamilyDrawing() {
    const setVar = useSetVar();
    const shift = useVar<number>("familyShift", DEFAULT_SHIFT);
    const markerX = useVar<number>("familyX", DEFAULT_X);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [markerActive, setMarkerActive] = useState(false);
    const draggingRef = useRef(false);
    const markerDraggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(markerActive ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const samples = Array.from({ length: 97 }, (_, index) => X_MIN + (index * (X_MAX - X_MIN)) / 96);
    const pathFor = (constant: number) =>
        samples
            .map((x, index) =>
                `${index === 0 ? "M" : "L"} ${xToScreen(x)} ${curveToScreen(curveValue(x, constant))}`,
            )
            .join(" ");

    const dragCurve = (event: React.PointerEvent<SVGPathElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const nextShift = screenToCurve(point.y) - screenToX(point.x) ** 2;
        setVar(
            "familyShift",
            clamp(Math.round(nextShift / SHIFT_STEP) * SHIFT_STEP, MIN_SHIFT, MAX_SHIFT),
        );
    };

    const dragMarker = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!markerDraggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        setVar("familyX", clamp(Math.round(screenToX(point.x) * 10) / 10, MIN_X, MAX_X));
    };

    const markerY = curveValue(markerX, shift);
    const slope = slopeValue(markerX);
    const halfRun = 0.7;
    const tangentX1 = xToScreen(markerX - halfRun);
    const tangentX2 = xToScreen(markerX + halfRun);
    const tangentY1 = curveToScreen(markerY - slope * halfRun);
    const tangentY2 = curveToScreen(markerY + slope * halfRun);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A stack of parabolas y equals x squared plus a constant, with the active curve draggable up and down"
        >
            <defs>
                <clipPath id="family-curve-clip">
                    <rect x={PLOT_LEFT - 6} y={PLOT_TOP - 4} width={PLOT_RIGHT - PLOT_LEFT + 12} height={PLOT_BOTTOM - PLOT_TOP + 8} />
                </clipPath>
                <filter id="family-curve-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Readouts — beside the drawing, never over it. */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x={PLOT_LEFT - 24} y="28" fill={ACCENT} opacity={opacity("shift")}>
                    {`C = ${formatShift(shift)}`}
                </text>
                <text x={PLOT_RIGHT} y="28" fill={PARTNER} textAnchor="end" opacity={opacity("steepness")}>
                    {`steepness = ${formatSlope(slope)}`}
                </text>
            </g>

            {/* Axes and the rest of the family — the before-state reference. */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={PLOT_LEFT - 12} y1={curveToScreen(0)} x2={PLOT_RIGHT} y2={curveToScreen(0)} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={xToScreen(0)} y1={PLOT_TOP} x2={xToScreen(0)} y2={PLOT_BOTTOM} stroke={INK_QUIET} strokeWidth="1.5" />
                <g clipPath="url(#family-curve-clip)">
                    {[-2, -1, 0, 1, 2, 3].map((constant) => (
                        <path key={constant} d={pathFor(constant)} fill="none" stroke={INK_QUIET} strokeWidth="1.5" strokeLinecap="round" />
                    ))}
                </g>
            </g>
            <XAxisLabels opacity={opacity("__structure")} />

            {/* The active curve — accent, draggable, the constant made visible. */}
            <g {...hoverProps("shift")} opacity={opacity("shift")} style={EASE_150}>
                <g clipPath="url(#family-curve-clip)">
                    <Halo active={isActive("shift")}>
                        <path d={pathFor(shift)} fill="none" stroke={ACCENT} strokeWidth={weight("shift", 3) + 6} strokeLinecap="round" />
                    </Halo>
                    <path
                        d={pathFor(shift)}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth={weight("shift", dragging || hovered ? 3.5 : 3)}
                        strokeLinecap="round"
                        style={{ transition: "stroke-width 150ms ease" }}
                    />
                    <path
                        d={pathFor(shift)}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="26"
                        style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            draggingRef.current = true;
                            setDragging(true);
                        }}
                        onPointerMove={dragCurve}
                        onPointerUp={() => {
                            draggingRef.current = false;
                            setDragging(false);
                        }}
                        onPointerCancel={() => {
                            draggingRef.current = false;
                            setDragging(false);
                        }}
                        onPointerEnter={() => setHovered(true)}
                        onPointerLeave={() => setHovered(false)}
                    />
                </g>
            </g>

            {/* The steepness at x — counterpart of the marker in the other view. */}
            <g {...hoverProps("steepness")} opacity={opacity("steepness")} style={EASE_150}>
                <g clipPath="url(#family-curve-clip)">
                    <Halo active={isActive("steepness")}>
                        <line x1={tangentX1} y1={tangentY1} x2={tangentX2} y2={tangentY2} stroke={PARTNER} strokeWidth={weight("steepness", 3) + 6} strokeLinecap="round" />
                    </Halo>
                    <line
                        x1={tangentX1}
                        y1={tangentY1}
                        x2={tangentX2}
                        y2={tangentY2}
                        stroke={PARTNER}
                        strokeWidth={weight("steepness", 3)}
                        strokeLinecap="round"
                    />
                </g>
                <g transform={`translate(${xToScreen(markerX)} ${curveToScreen(markerY)}) scale(${handleScale})`}>
                    <circle r="7" fill={PARTNER} filter="url(#family-curve-shadow)" />
                </g>
                <circle
                    cx={xToScreen(markerX)}
                    cy={curveToScreen(markerY)}
                    r="22"
                    fill="transparent"
                    style={{ cursor: markerActive ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        markerDraggingRef.current = true;
                        setMarkerActive(true);
                    }}
                    onPointerMove={dragMarker}
                    onPointerUp={() => {
                        markerDraggingRef.current = false;
                        setMarkerActive(false);
                    }}
                    onPointerCancel={() => {
                        markerDraggingRef.current = false;
                        setMarkerActive(false);
                    }}
                    onPointerEnter={() => setMarkerActive(true)}
                    onPointerLeave={() => {
                        if (!markerDraggingRef.current) setMarkerActive(false);
                    }}
                />
            </g>
        </svg>
    );
}

// ── VIEW B: the steepness graph ──────────────────────────────────────────────

function SteepnessGraphDrawing() {
    const setVar = useSetVar();
    const markerX = useVar<number>("familyX", DEFAULT_X);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const dragMarker = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        setVar("familyX", clamp(Math.round(screenToX(point.x) * 10) / 10, MIN_X, MAX_X));
    };

    const slope = slopeValue(markerX);
    const pointX = xToScreen(markerX);
    const pointY = slopeToScreen(slope);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="The graph of the steepness, y prime equals 2x, with a draggable marker"
        >
            <defs>
                <filter id="family-slope-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x={PLOT_LEFT - 24} y="28" fill={INK} opacity={opacity("__structure")}>
                    steepness of every curve
                </text>
                <text x={PLOT_RIGHT} y="28" fill={PARTNER} textAnchor="end" opacity={opacity("steepness")}>
                    {formatSlope(slope)}
                </text>
            </g>

            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={PLOT_LEFT - 12} y1={slopeToScreen(0)} x2={PLOT_RIGHT} y2={slopeToScreen(0)} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={xToScreen(0)} y1={PLOT_TOP} x2={xToScreen(0)} y2={PLOT_BOTTOM} stroke={INK_QUIET} strokeWidth="1.5" />
                <line
                    x1={xToScreen(X_MIN)}
                    y1={slopeToScreen(slopeValue(X_MIN))}
                    x2={xToScreen(X_MAX)}
                    y2={slopeToScreen(slopeValue(X_MAX))}
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </g>
            <XAxisLabels opacity={opacity("__structure")} />

            {/* The steepness at x — same id, same hue as the tangent next door. */}
            <g {...hoverProps("steepness")} opacity={opacity("steepness")} style={EASE_150}>
                <Halo active={isActive("steepness")}>
                    <line x1={pointX} y1={slopeToScreen(0)} x2={pointX} y2={pointY} stroke={PARTNER} strokeWidth={weight("steepness", 3) + 6} strokeLinecap="round" />
                </Halo>
                <line
                    x1={pointX}
                    y1={slopeToScreen(0)}
                    x2={pointX}
                    y2={pointY}
                    stroke={PARTNER}
                    strokeWidth={weight("steepness", 3)}
                    strokeLinecap="round"
                />
                <g transform={`translate(${pointX} ${pointY}) scale(${handleScale})`}>
                    <circle r="8" fill={PARTNER} filter="url(#family-slope-shadow)" />
                </g>
            </g>

            <circle
                cx={pointX}
                cy={pointY}
                r="24"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={dragMarker}
                onPointerUp={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                    setDragging(false);
                }}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
        </svg>
    );
}

// ── Figure shells ────────────────────────────────────────────────────────────

function CurveFamilyFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="family-curves"
            onReset={() => {
                setVar("familyShift", DEFAULT_SHIFT);
                setVar("familyX", DEFAULT_X);
                setVar("familyHighlight", "");
            }}
            caption="Grab the teal curve and drag it up or down. The pale curves it slides past are the rest of the family."
        >
            <CurveFamilyDrawing />
            <InteractionHintSequence
                hintKey="family-curve-drag"
                steps={[
                    {
                        gesture: "drag-vertical",
                        label: "Drag the teal curve up or down",
                        position: { x: "53%", y: "63%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: -26 }, endOffset: { x: 0, y: 26 } },
                    },
                ]}
            />
        </Figure>
    );
}

function SteepnessGraphFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="family-steepness"
            onReset={() => {
                setVar("familyX", DEFAULT_X);
                setVar("familyHighlight", "");
            }}
            caption="The steepness of the curve, plotted against x. Drag the indigo marker to read it anywhere."
        >
            <SteepnessGraphDrawing />
            <InteractionHintSequence
                hintKey="family-slope-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the indigo marker along the line",
                        position: { x: "70%", y: "35%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const familyOfCurvesBlocks: ReactElement[] = [
    <StackLayout key="layout-family-heading" maxWidth="xl">
        <Block id="family-heading" padding="md">
            <EditableH2 id="h2-family-heading" blockId="family-heading">
                The Family of Curves
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-setup" maxWidth="xl">
        <Block id="family-setup" padding="sm">
            <EditableParagraph id="para-family-setup" blockId="family-setup">
                Here is the catch with running things backwards. Grab the teal curve and drag
                it up or down: you are sliding through a whole stack of curves, each one x²
                plus a different constant, currently{" "}
                <InlineScrubbleNumber
                    varName="familyShift"
                    {...numberPropsFromDefinition(getVariableInfo('familyShift'))}
                    formatValue={formatShift}
                />
                . The graph beside it plots the{" "}
                <InlineLinkedHighlight
                    varName="familyHighlight"
                    highlightId="steepness"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('familyHighlight'))}
                >
                    steepness
                </InlineLinkedHighlight>{" "}
                of that curve at every x.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-family-pair" ratio="1:1" gap="lg" align="start">
        <Block id="family-curves-figure" padding="sm" hasVisualization>
            <CurveFamilyFigure />
        </Block>
        <Block id="family-steepness-figure" padding="sm" hasVisualization>
            <SteepnessGraphFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-family-insight" maxWidth="xl">
        <Block id="family-insight" padding="sm">
            <EditableParagraph id="para-family-insight" blockId="family-insight">
                The stack slides, and the steepness graph never budges. Every curve in the
                family has the same steepness at the same x, so all of them differentiate to
                2x. That is why an integral ends with a constant we call C: shifting a curve
                up or down is the one change differentiating cannot see.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-question-both" maxWidth="xl">
        <Block id="family-question-both" padding="md">
            <EditableParagraph id="para-family-question-both" blockId="family-question-both">
                Maya integrates 2x and writes x², while Theo writes x² + 2. Checking their
                answers by differentiating,{" "}
                <InlineFeedback
                    varName="answer_family_constant"
                    correctValue="both are right"
                    position="terminal"
                    successMessage="— yes, both differentiate straight back to 2x, which is why we write x² + C to cover every one of them"
                    failureMessage="— have another look."
                    hint="Differentiate each answer and compare what comes out"
                    visualizationHint={{
                        blockId: "family-curves-figure",
                        hintKey: "family-discover",
                        label: "Check it on the curves",
                        steps: [
                            {
                                gesture: "drag-vertical",
                                label: "Drag the teal curve up until C reads 2, and watch the steepness graph",
                                position: { x: "53%", y: "63%" },
                                completionVar: "familyShift",
                                completionValue: 2,
                                completionTolerance: 0.3,
                            },
                            {
                                gesture: "drag-vertical",
                                label: "Now drag it back down to C = 0 — did the steepness ever change?",
                                position: { x: "53%", y: "45%" },
                                completionVar: "familyShift",
                                completionValue: 0,
                                completionTolerance: 0.3,
                            },
                        ],
                        resetVars: { familyShift: 0, familyX: 1 },
                    }}
                >
                    <InlineClozeChoice
                        varName="answer_family_constant"
                        correctAnswer="both are right"
                        options={["only Maya is right", "only Theo is right", "both are right"]}
                        {...choicePropsFromDefinition(getVariableInfo('answer_family_constant'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-question-origin" maxWidth="xl">
        <Block id="family-question-origin" padding="md">
            <EditableParagraph id="para-family-question-origin" blockId="family-question-origin">
                Out of that whole family, one curve passes through the origin. For that
                single curve, C must be{" "}
                <InlineFeedback
                    varName="answer_family_origin"
                    correctValue={["0", "zero"]}
                    position="terminal"
                    successMessage="— exactly, and that is how extra information picks one curve out of the family"
                    failureMessage="— not that one."
                    hint="Put x = 0 into x² + C and ask what makes the answer 0"
                    reviewBlockId="family-curves-figure"
                    reviewLabel="Look at the family again"
                >
                    <InlineClozeInput
                        varName="answer_family_origin"
                        correctAnswer={["0", "zero"]}
                        {...clozePropsFromDefinition(getVariableInfo('answer_family_origin'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
