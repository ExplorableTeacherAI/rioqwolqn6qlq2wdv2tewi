/**
 * Section 4 — EXPLORE: "The Family of Curves"
 *
 * Constructivist / inversion paradigm: the student is given only a derivative
 * (2x) and stamps candidate curves onto an empty board. Every stamp is
 * accepted, and the steepness bars they all carry stay parallel — so the
 * evidence can never pin down the constant. That is where + C comes from.
 */

import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineTooltip,
    InlineTrigger,
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

const MIN_CONSTANT = -2;
const MAX_CONSTANT = 3;
const CONSTANT_STEP = 0.5;
const MIN_X = -2;
const MAX_X = 2;
const DEFAULT_X = 1;
const DEFAULT_STAMPS = "0";
const MAX_STAMPS = 8;

const curveValue = (x: number, constant: number) => x * x + constant;
const slopeValue = (x: number) => 2 * x;

/** One formatter per quantity — figure, readouts and prose all use these. */
const formatX = (value: number) => value.toFixed(1);
const formatSlope = (value: number) => value.toFixed(1);

const parseStamps = (raw: string): number[] =>
    raw
        .split(",")
        .map((piece) => Number(piece))
        .filter((value) => Number.isFinite(value));

// ── View constants ───────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 380;
const PLOT_LEFT = 72;
const PLOT_RIGHT = 488;
const PLOT_TOP = 48;
const PLOT_BOTTOM = 330;
const X_MIN = -2.6;
const X_MAX = 2.6;
const Y_MIN = -2.5;
const Y_MAX = 7.5;

const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD"; // the curves the student stamps
const PARTNER = "#8E90F5"; // the steepness they all share

const xToScreen = (x: number) => remap(x, X_MIN, X_MAX, PLOT_LEFT, PLOT_RIGHT);
const screenToX = (px: number) => remap(px, PLOT_LEFT, PLOT_RIGHT, X_MIN, X_MAX);
const yToScreen = (y: number) => remap(y, Y_MIN, Y_MAX, PLOT_BOTTOM, PLOT_TOP);
const screenToY = (py: number) => remap(py, PLOT_BOTTOM, PLOT_TOP, Y_MIN, Y_MAX);

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

// ── The bespoke drawing ──────────────────────────────────────────────────────

function CandidateBoardDrawing() {
    const setVar = useSetVar();
    const stampsRaw = useVar<string>("familyStamps", DEFAULT_STAMPS);
    const checkX = useVar<number>("familyX", DEFAULT_X);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const stamps = parseStamps(stampsRaw);
    const slope = slopeValue(checkX);

    const samples = Array.from({ length: 97 }, (_, index) => X_MIN + (index * (X_MAX - X_MIN)) / 96);
    const pathFor = (constant: number) =>
        samples
            .map((x, index) => `${index === 0 ? "M" : "L"} ${xToScreen(x)} ${yToScreen(curveValue(x, constant))}`)
            .join(" ");

    // Every click stamps a candidate curve — nothing is ever rejected.
    const stampAt = (event: React.MouseEvent<SVGRectElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const px = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const py = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        const raw = screenToY(py) - screenToX(px) ** 2;
        const constant = clamp(
            Math.round(raw / CONSTANT_STEP) * CONSTANT_STEP,
            MIN_CONSTANT,
            MAX_CONSTANT,
        );
        if (stamps.some((existing) => Math.abs(existing - constant) < 0.25)) return;
        const next = [...stamps, constant].slice(-MAX_STAMPS);
        setVar("familyStamps", next.join(","));
        setVar("familyStampCount", next.length);
    };

    const dragCheckLine = (event: React.PointerEvent<SVGRectElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        setVar("familyX", clamp(Math.round(screenToX(point.x) * 10) / 10, MIN_X, MAX_X));
    };

    const lineX = xToScreen(checkX);
    const halfRun = 0.55;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A board where candidate curves are stamped, each carrying a steepness bar at the same x"
        >
            <defs>
                <clipPath id="family-board-clip">
                    <rect
                        x={PLOT_LEFT - 6}
                        y={PLOT_TOP - 4}
                        width={PLOT_RIGHT - PLOT_LEFT + 12}
                        height={PLOT_BOTTOM - PLOT_TOP + 8}
                    />
                </clipPath>
                <filter id="family-board-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Readouts — above the drawing surface, never on it. */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="28" fill={ACCENT} opacity={opacity("curves")}>
                    {`curves that fit: ${stamps.length}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="28" fill={PARTNER} textAnchor="end" opacity={opacity("steepness")}>
                    {`steepness at x = ${formatX(checkX)} is ${formatSlope(slope)}`}
                </text>
            </g>

            {/* Click surface — every empty patch of board is stampable. */}
            <rect
                x={PLOT_LEFT}
                y={PLOT_TOP}
                width={PLOT_RIGHT - PLOT_LEFT}
                height={PLOT_BOTTOM - PLOT_TOP}
                fill="transparent"
                style={{ cursor: "copy" }}
                onClick={stampAt}
            />

            {/* Axes and ticks — ambient structure. */}
            <g opacity={opacity("__structure")} style={EASE_150} pointerEvents="none">
                <line x1={PLOT_LEFT - 12} y1={yToScreen(0)} x2={PLOT_RIGHT} y2={yToScreen(0)} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={xToScreen(0)} y1={PLOT_TOP} x2={xToScreen(0)} y2={PLOT_BOTTOM} stroke={INK_QUIET} strokeWidth="1.5" />
                {[-2, -1, 1, 2].map((tick) => (
                    <text
                        key={tick}
                        x={xToScreen(tick)}
                        y={352}
                        fontSize="11"
                        fill={INK_STRUCTURE}
                        textAnchor="middle"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {tick}
                    </text>
                ))}
                <text x={xToScreen(0)} y={352} fontSize="11" fill={INK_STRUCTURE} textAnchor="middle">
                    0
                </text>
            </g>

            {/* The stamped candidates — all equal, all accepted. */}
            <g {...hoverProps("curves")} opacity={opacity("curves")} style={EASE_150}>
                <g clipPath="url(#family-board-clip)">
                    {stamps.map((constant) => (
                        <g key={constant}>
                            <Halo active={isActive("curves")}>
                                <path d={pathFor(constant)} fill="none" stroke={ACCENT} strokeWidth={weight("curves", 3) + 6} strokeLinecap="round" />
                            </Halo>
                            <path
                                d={pathFor(constant)}
                                fill="none"
                                stroke={ACCENT}
                                strokeWidth={weight("curves", 3)}
                                strokeLinecap="round"
                            />
                        </g>
                    ))}
                </g>
            </g>

            {/* The check line and one steepness bar per curve — always parallel. */}
            <g {...hoverProps("steepness")} opacity={opacity("steepness")} style={EASE_150}>
                <line
                    x1={lineX}
                    y1={PLOT_TOP}
                    x2={lineX}
                    y2={PLOT_BOTTOM}
                    stroke={PARTNER}
                    strokeWidth="1.5"
                    strokeDasharray="4 5"
                    opacity={0.7}
                />
                <g clipPath="url(#family-board-clip)">
                    {stamps.map((constant) => {
                        const centre = curveValue(checkX, constant);
                        return (
                            <g key={`bar-${constant}`}>
                                <Halo active={isActive("steepness")}>
                                    <line
                                        x1={xToScreen(checkX - halfRun)}
                                        y1={yToScreen(centre - slope * halfRun)}
                                        x2={xToScreen(checkX + halfRun)}
                                        y2={yToScreen(centre + slope * halfRun)}
                                        stroke={PARTNER}
                                        strokeWidth={weight("steepness", 3) + 6}
                                        strokeLinecap="round"
                                    />
                                </Halo>
                                <line
                                    x1={xToScreen(checkX - halfRun)}
                                    y1={yToScreen(centre - slope * halfRun)}
                                    x2={xToScreen(checkX + halfRun)}
                                    y2={yToScreen(centre + slope * halfRun)}
                                    stroke={PARTNER}
                                    strokeWidth={weight("steepness", 3)}
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    })}
                </g>
                <g transform={`translate(${lineX} ${PLOT_BOTTOM + 12}) scale(${handleScale})`}>
                    <circle r="9" fill={PARTNER} filter="url(#family-board-shadow)" />
                </g>
            </g>

            {/* Drag handle for the check line — on top, so it never stamps. */}
            <rect
                x={lineX - 22}
                y={PLOT_TOP}
                width={44}
                height={PLOT_BOTTOM - PLOT_TOP + 34}
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={dragCheckLine}
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
                onClick={(event) => event.stopPropagation()}
            />
        </svg>
    );
}

function CandidateBoardFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="family-candidate-board"
            onReset={() => {
                setVar("familyStamps", DEFAULT_STAMPS);
                setVar("familyStampCount", 1);
                setVar("familyX", DEFAULT_X);
                setVar("familyHighlight", "");
            }}
            caption="All the evidence says is that the derivative was 2x. Click anywhere to stamp another curve that fits, and drag the dashed line to compare their steepness bars."
        >
            <CandidateBoardDrawing />
            <InteractionHintSequence
                hintKey="family-board-stamp"
                steps={[
                    {
                        gesture: "click",
                        label: "Click to stamp another curve",
                        position: { x: "38%", y: "32%" },
                    },
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the dashed line across the board",
                        position: { x: "66%", y: "90%" },
                        dragPath: { type: "line", startOffset: { x: -28, y: 0 }, endOffset: { x: 28, y: 0 } },
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
                A curve has gone missing and the only clue left behind is its derivative,{" "}
                <InlineFormula
                    id="formula-family-setup-clue"
                    latex="\clr{slope}{2x}"
                    colorMap={{ slope: PARTNER }}
                />
                . One suspect,{" "}
                <InlineFormula
                    id="formula-family-setup-suspect"
                    latex="\clr{curve}{x^2}"
                    colorMap={{ curve: ACCENT }}
                />
                , is already on the board. Click anywhere to stamp another{" "}
                <InlineLinkedHighlight
                    id="link-family-setup-curves"
                    varName="familyHighlight"
                    highlightId="curves"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('familyHighlight'))}
                >
                    curve
                </InlineLinkedHighlight>{" "}
                you think fits the clue, then drag the dashed line to compare every
                suspect's{" "}
                <InlineLinkedHighlight
                    varName="familyHighlight"
                    highlightId="steepness"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('familyHighlight'))}
                    color={PARTNER}
                    bgColor="rgba(142, 144, 245, 0.22)"
                >
                    steepness
                </InlineLinkedHighlight>{" "}
                at x ={" "}
                <InlineScrubbleNumber
                    varName="familyX"
                    {...numberPropsFromDefinition(getVariableInfo('familyX'))}
                    formatValue={formatX}
                />
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-board" maxWidth="xl">
        <Block id="family-board-figure" padding="sm" hasVisualization>
            <CandidateBoardFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-insight" maxWidth="xl">
        <Block id="family-insight" padding="sm">
            <EditableParagraph id="para-family-insight" blockId="family-insight">
                Every suspect fits, and their steepness bars stay stubbornly parallel. Sliding
                a curve up or down never changes how steep it is, so the clue{" "}
                <InlineFormula
                    id="formula-family-insight-clue"
                    latex="\clr{slope}{2x}"
                    colorMap={{ slope: PARTNER }}
                />{" "}
                can only narrow things down to{" "}
                <InlineFormula
                    id="formula-family-insight-curve"
                    latex="\clr{curve}{x^2}"
                    colorMap={{ curve: ACCENT }}
                />{" "}
                plus some{" "}
                <InlineTooltip
                    id="tooltip-family-insight-constant"
                    tooltip="A constant is a fixed number, such as 2 or -1.5, that stays the same whatever x is."
                    color="#2563EB"
                    bgColor="rgba(37, 99, 235, 0.12)"
                >
                    constant
                </InlineTooltip>
                . We write that constant as C, and
                it stands for the whole board at once.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-family-question-both" maxWidth="xl">
        <Block id="family-question-both" padding="md">
            <EditableParagraph id="para-family-question-both" blockId="family-question-both">
                Maya integrates{" "}
                <InlineFormula
                    id="formula-family-question-both-given"
                    latex="\clr{slope}{2x}"
                    colorMap={{ slope: PARTNER }}
                />{" "}
                and writes{" "}
                <InlineFormula
                    id="formula-family-question-both-maya"
                    latex="\clr{curve}{x^2}"
                    colorMap={{ curve: ACCENT }}
                />
                , while Theo writes{" "}
                <InlineFormula
                    id="formula-family-question-both-theo"
                    latex="\clr{curve}{x^2 + 2}"
                    colorMap={{ curve: ACCENT }}
                />
                . Checking their
                answers by differentiating,{" "}
                <InlineFeedback
                    varName="answer_family_constant"
                    correctValue="both are right"
                    position="terminal"
                    successMessage="— yes, both differentiate straight back to 2x, which is why we write x² + C to cover every suspect at once"
                    failureMessage="— have another look."
                    hint="Differentiate each answer and compare what comes out"
                    visualizationHint={{
                        blockId: "family-board-figure",
                        hintKey: "family-board-discover",
                        label: "Test it on the board",
                        steps: [
                            {
                                gesture: "click",
                                label: "Click high above the first curve to stamp Theo's answer too",
                                position: { x: "38%", y: "30%" },
                                completionVar: "familyStampCount",
                                completionValue: 2,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Drag the dashed line across — do the two steepness bars ever differ?",
                                position: { x: "66%", y: "90%" },
                                completionVar: "familyX",
                                completionValue: -1,
                                completionTolerance: 0.6,
                            },
                        ],
                        resetVars: { familyStamps: "0", familyStampCount: 1, familyX: 1 },
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
                Out of that whole board of suspects, exactly one curve passes through{" "}
                <InlineTrigger
                    id="trigger-family-question-origin"
                    varName="familyX"
                    value={0}
                    color={PARTNER}
                    bgColor="rgba(142, 144, 245, 0.18)"
                >
                    the origin
                </InlineTrigger>
                . For that single curve, C must be{" "}
                <InlineFeedback
                    varName="answer_family_origin"
                    correctValue={["0", "zero"]}
                    position="terminal"
                    successMessage="— exactly, and that is how one extra fact picks a single curve out of the family"
                    failureMessage="— not that one."
                    hint="Put x = 0 into x² + C and ask what makes the answer 0"
                    reviewBlockId="family-board-figure"
                    reviewLabel="Look at the board again"
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
