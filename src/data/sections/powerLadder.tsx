/**
 * Section 3 — EXPLORE: "Add One, Then Divide"
 *
 * Goal/constraint paradigm: the student builds the integral of x^n by placing
 * a token on the power ladder and choosing the divisor, and the figure
 * differentiates their answer back live. Landing on the start term is the goal.
 */

import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineScrubbleNumber,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, remap, useSpring, type Vec2 } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    numberPropsFromDefinition,
} from "../variables";

// ── Domain model ─────────────────────────────────────────────────────────────

const MIN_RUNG = 1;
const MAX_RUNG = 6;
const MIN_DIVISOR = 1;
const MAX_DIVISOR = 6;
const DEFAULT_START = 3;
const DEFAULT_CHOSEN = 5;
const DEFAULT_DIVISOR = 1;

const greatestCommonDivisor = (a: number, b: number): number =>
    b === 0 ? a : greatestCommonDivisor(b, a % b);

/** One formatter for the derivative's coefficient, used everywhere it appears. */
const formatRatio = (numerator: number, denominator: number): string => {
    const divisor = greatestCommonDivisor(numerator, denominator);
    const top = numerator / divisor;
    const bottom = denominator / divisor;
    return bottom === 1 ? `${top}` : `${top}/${bottom}`;
};

// ── View constants ───────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 344;

const GIVEN_X = 120;
const TOKEN_X = 170;
const RUNG_LEFT = 104;
const RUNG_RIGHT = 186;
const BOTTOM_RUNG_Y = 292;
const RUNG_GAP = 46;

const DIAL_LEFT = 250;
const DIAL_RIGHT = 500;
const DIAL_Y = 306;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD"; // what the student builds
const GIVEN = "#8E90F5"; // the term they were given

const yForRung = (rung: number) => BOTTOM_RUNG_Y - (rung - 1) * RUNG_GAP;

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── Term rendering ───────────────────────────────────────────────────────────

function Term({
    x,
    y,
    coefficient,
    power,
    fontSize,
    fill,
}: {
    x: number;
    y: number;
    coefficient?: string;
    power: number;
    fontSize: number;
    fill: string;
}) {
    const showCoefficient = coefficient !== undefined && coefficient !== "1";
    if (power === 0) {
        return (
            <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
                {coefficient ?? "1"}
            </text>
        );
    }
    return (
        <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
            {showCoefficient ? coefficient : ""}
            <tspan fontStyle="italic">x</tspan>
            {power !== 1 ? (
                <tspan dy={-fontSize * 0.42} fontSize={fontSize * 0.62}>
                    {power}
                </tspan>
            ) : null}
        </text>
    );
}

// ── The divide-by dial ───────────────────────────────────────────────────────

function DivisorDial({
    value,
    onChange,
}: {
    value: number;
    onChange: (next: number) => void;
}) {
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const rectRef = useRef<SVGRectElement>(null);

    const knobX = useSpring(remap(value, MIN_DIVISOR, MAX_DIVISOR, DIAL_LEFT, DIAL_RIGHT), {
        stiffness: 260,
        damping: 24,
    });
    const knobScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const updateFromEvent = (event: React.PointerEvent<SVGRectElement>) => {
        const point = svgPointFromEvent(event, rectRef.current?.ownerSVGElement ?? null);
        const raw = remap(point.x, DIAL_LEFT, DIAL_RIGHT, MIN_DIVISOR, MAX_DIVISOR);
        onChange(clamp(Math.round(raw), MIN_DIVISOR, MAX_DIVISOR));
    };

    return (
        <g>
            <text x={DIAL_LEFT} y={DIAL_Y - 18} fontSize="11" fill={INK_STRUCTURE}>
                divide by
            </text>
            <text
                x={DIAL_RIGHT}
                y={DIAL_Y - 18}
                fontSize="12"
                fill={ACCENT}
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </text>
            <line
                x1={DIAL_LEFT}
                y1={DIAL_Y}
                x2={DIAL_RIGHT}
                y2={DIAL_Y}
                stroke={INK_QUIET}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <g transform={`translate(${knobX} ${DIAL_Y}) scale(${knobScale})`}>
                <circle r="11" fill={ACCENT} filter="url(#power-ladder-shadow)" />
            </g>
            <rect
                ref={rectRef}
                x={DIAL_LEFT - 22}
                y={DIAL_Y - 20}
                width={DIAL_RIGHT - DIAL_LEFT + 44}
                height={40}
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                    updateFromEvent(event);
                }}
                onPointerMove={(event) => {
                    if (!draggingRef.current) return;
                    updateFromEvent(event);
                }}
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
    );
}

// ── The bespoke drawing ──────────────────────────────────────────────────────

function PowerLadderDrawing() {
    const setVar = useSetVar();
    const startPower = useVar<number>("ladderStartPower", DEFAULT_START);
    const chosenPower = useVar<number>("ladderChosenPower", DEFAULT_CHOSEN);
    const divisor = useVar<number>("ladderDivisor", DEFAULT_DIVISOR);

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);

    const tokenY = useSpring(yForRung(chosenPower), { stiffness: 260, damping: 24 });
    const tokenScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    // The model draws the view: differentiate the student's answer and compare.
    const checkPower = chosenPower - 1;
    const checkCoefficient = formatRatio(chosenPower, divisor);
    const backAtStart = checkPower === startPower && chosenPower === divisor;

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = remap(point.y, BOTTOM_RUNG_Y, yForRung(MAX_RUNG), MIN_RUNG, MAX_RUNG);
        setVar("ladderChosenPower", clamp(Math.round(raw), MIN_RUNG, MAX_RUNG));
    };

    const givenY = yForRung(startPower);
    const chosenY = yForRung(chosenPower);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A ladder of powers of x with a draggable token, beside the student's answer and its derivative"
        >
            <defs>
                <filter id="power-ladder-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Column headers */}
            <text x={GIVEN_X} y="34" fontSize="11" fill={GIVEN} textAnchor="middle">
                given
            </text>
            <text x={TOKEN_X} y="34" fontSize="11" fill={ACCENT} textAnchor="middle">
                you
            </text>

            {/* The ladder: one rung per power, labelled directly. */}
            {[1, 2, 3, 4, 5, 6].map((rung) => (
                <g key={rung}>
                    <line
                        x1={RUNG_LEFT}
                        y1={yForRung(rung)}
                        x2={RUNG_RIGHT}
                        y2={yForRung(rung)}
                        stroke={INK_QUIET}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    <Term x={88} y={yForRung(rung) + 5} power={rung} fontSize={14} fill={INK} />
                </g>
            ))}

            {/* The step from the given term to the chosen one. */}
            <path
                d={`M ${GIVEN_X + 12} ${givenY} Q ${(GIVEN_X + TOKEN_X) / 2} ${(givenY + chosenY) / 2 - 10} ${TOKEN_X - 14} ${chosenY}`}
                fill="none"
                stroke={INK_STRUCTURE}
                strokeWidth="1.5"
                strokeLinecap="round"
            />

            {/* The given term's marker. */}
            <circle cx={GIVEN_X} cy={givenY} r="9" fill="#FFFFFF" stroke={GIVEN} strokeWidth="2.5" />

            {/* The draggable token — the power the student chooses. */}
            <g transform={`translate(${TOKEN_X} ${tokenY}) scale(${tokenScale})`}>
                <circle r="11" fill={ACCENT} filter="url(#power-ladder-shadow)" />
            </g>
            <circle
                cx={TOKEN_X}
                cy={chosenY}
                r="24"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={handlePointerMove}
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

            {/* The answer being built, as a fraction. */}
            <text x="250" y="72" fontSize="11" fill={INK_STRUCTURE}>
                your answer
            </text>
            <Term x={330} y={106} power={chosenPower} fontSize={22} fill={ACCENT} />
            <line x1="296" y1="118" x2="364" y2="118" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
            <text
                x="330"
                y="146"
                fontSize="22"
                fill={ACCENT}
                textAnchor="middle"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {divisor}
            </text>

            {/* The live check: differentiate what they built. */}
            <text x="250" y="192" fontSize="11" fill={INK_STRUCTURE}>
                differentiate it and you get
            </text>
            <Term
                x={330}
                y={224}
                coefficient={checkCoefficient}
                power={checkPower}
                fontSize={20}
                fill={backAtStart ? ACCENT : INK}
            />
            <text
                x="330"
                y="256"
                fontSize="13"
                fill={backAtStart ? ACCENT : INK_STRUCTURE}
                textAnchor="middle"
                style={{ transition: "fill 150ms ease" }}
            >
                {backAtStart ? "back to the given term" : "not the given term yet"}
            </text>

            <DivisorDial value={divisor} onChange={(next) => setVar("ladderDivisor", next)} />
        </svg>
    );
}

function PowerLadderFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="power-ladder"
            onReset={() => {
                setVar("ladderChosenPower", DEFAULT_CHOSEN);
                setVar("ladderDivisor", DEFAULT_DIVISOR);
            }}
            caption="Drag the teal token to the rung your answer belongs on, then drag the divide-by dial. The panel differentiates your answer as you go."
        >
            <PowerLadderDrawing />
            <InteractionHintSequence
                hintKey="power-ladder-build"
                steps={[
                    {
                        gesture: "drag-vertical",
                        label: "Drag the teal token to another rung",
                        position: { x: "30%", y: "31%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: 0, y: -24 },
                            endOffset: { x: 0, y: 24 },
                        },
                    },
                    {
                        gesture: "drag-horizontal",
                        label: "Now drag the divide-by dial",
                        position: { x: "67%", y: "89%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: -26, y: 0 },
                            endOffset: { x: 26, y: 0 },
                        },
                    },
                ]}
            />
        </Figure>
    );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export const powerLadderBlocks: ReactElement[] = [
    <StackLayout key="layout-power-ladder-heading" maxWidth="xl">
        <Block id="power-ladder-heading" padding="md">
            <EditableH2 id="h2-power-ladder-heading" blockId="power-ladder-heading">
                Add One, Then Divide
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-setup" maxWidth="xl">
        <Block id="power-ladder-setup" padding="sm">
            <EditableParagraph id="para-power-ladder-setup" blockId="power-ladder-setup">
                Every power of x gets its own rung on this ladder, and the term you are
                integrating is x to the power{" "}
                <InlineScrubbleNumber
                    varName="ladderStartPower"
                    {...numberPropsFromDefinition(getVariableInfo('ladderStartPower'))}
                />
                . Drag the teal token to the rung you think the answer lives on, then drag
                the divide-by dial until differentiating your answer lands you back on the
                given term.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-figure" maxWidth="xl">
        <Block id="power-ladder-figure" padding="sm" hasVisualization>
            <PowerLadderFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-worked" maxWidth="xl">
        <Block id="power-ladder-worked" padding="sm">
            <EditableParagraph id="para-power-ladder-worked" blockId="power-ladder-worked">
                Take x³ as the given term. Step up one rung to x⁴, then divide by that new
                power, 4, giving x⁴ over 4. Differentiate that and the fours cancel, leaving
                x³ exactly as it started.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-rule" maxWidth="xl">
        <Block id="power-ladder-rule" padding="lg">
            <FormulaBlock
                latex="\int \clr{given}{x^{n}} \, dx = \frac{\clr{built}{x^{n+1}}}{\clr{built}{n+1}}"
                colorMap={{ given: "#8E90F5", built: "#62D0AD" }}
                color="#334155"
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-question-power" maxWidth="xl">
        <Block id="power-ladder-question-power" padding="md">
            <EditableParagraph id="para-power-ladder-question-power" blockId="power-ladder-question-power">
                Try it on x⁵. Integrating pushes the power up to{" "}
                <InlineFeedback
                    varName="answer_ladder_power"
                    correctValue={["6", "six"]}
                    position="terminal"
                    successMessage="— yes, one step up the ladder from 5"
                    failureMessage="— not that one."
                    hint="Integrating always climbs the ladder by exactly one rung"
                    visualizationHint={{
                        blockId: "power-ladder-figure",
                        hintKey: "power-ladder-discover",
                        label: "Work it out on the ladder",
                        steps: [
                            {
                                gesture: "drag-vertical",
                                label: "Drag the teal token up until differentiating gives back x⁵",
                                position: { x: "30%", y: "45%" },
                                completionVar: "ladderChosenPower",
                                completionValue: 6,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Now drag the divide-by dial until the panel says you are back on the given term",
                                position: { x: "67%", y: "89%" },
                                completionVar: "ladderDivisor",
                                completionValue: 6,
                                completionTolerance: 0.4,
                            },
                        ],
                        resetVars: { ladderStartPower: 5, ladderChosenPower: 4, ladderDivisor: 1 },
                    }}
                >
                    <InlineClozeInput
                        varName="answer_ladder_power"
                        correctAnswer={["6", "six"]}
                        {...clozePropsFromDefinition(getVariableInfo('answer_ladder_power'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-question-divisor" maxWidth="xl">
        <Block id="power-ladder-question-divisor" padding="md">
            <EditableParagraph id="para-power-ladder-question-divisor" blockId="power-ladder-question-divisor">
                To finish that integral, the whole thing then gets divided by{" "}
                <InlineFeedback
                    varName="answer_ladder_divisor"
                    correctValue={["6", "six"]}
                    position="terminal"
                    successMessage="— right, you always divide by the new power, so x⁵ integrates to x⁶ over 6"
                    failureMessage="— close, but check which power you divide by."
                    hint="It is the power you just climbed to, not the one you came from"
                    reviewBlockId="power-ladder-rule"
                    reviewLabel="Look at the rule again"
                >
                    <InlineClozeInput
                        varName="answer_ladder_divisor"
                        correctAnswer={["6", "six"]}
                        {...clozePropsFromDefinition(getVariableInfo('answer_ladder_divisor'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
