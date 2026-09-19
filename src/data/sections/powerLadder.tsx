/**
 * Section 3 — EXPLORE: "Add One, Then Divide"
 *
 * Constructivist paradigm: the answer to an integral is an empty template with
 * two boxes. The student drags number tiles into them and the panel
 * differentiates whatever they assemble, so a wrong build is informative
 * rather than punished.
 */

import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineScrubbleNumber,
    InlineSpotColor,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { useSpring, type Vec2 } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    numberPropsFromDefinition,
    spotColorPropsFromDefinition,
} from "../variables";

// ── Domain model ─────────────────────────────────────────────────────────────

const DEFAULT_START = 3;
const TILE_VALUES = [1, 2, 3, 4, 5, 6];

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
const VIEW_HEIGHT = 360;

const POWER_HUE = "#F7B23B"; // the new power (same amber as the power dial)
const DIVISOR_HUE = "#F8A0CD"; // the number you divide by (same rose as the coefficient dial)

const POWER_SLOT = { x: 412, y: 74, size: 32, hue: POWER_HUE, tint: "rgba(247, 178, 59, 0.18)" };
const DIVISOR_SLOT = { x: 404, y: 136, size: 32, hue: DIVISOR_HUE, tint: "rgba(248, 160, 205, 0.2)" };
const FRACTION_BAR = { x1: 374, x2: 458, y: 124 };

const TILE_SIZE = 40;
const TILE_Y = 262;
const TILE_START_X = 100;
const TILE_GAP = 76;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD"; // what the student assembles
const GIVEN = "#8E90F5"; // the term they were handed

const tileCentre = (index: number) => ({ x: TILE_START_X + index * TILE_GAP, y: TILE_Y + TILE_SIZE / 2 });

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

const isInsideSlot = (point: Vec2, slot: { x: number; y: number; size: number }) =>
    point.x > slot.x - 18 &&
    point.x < slot.x + slot.size + 18 &&
    point.y > slot.y - 18 &&
    point.y < slot.y + slot.size + 18;

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
    if (power === 0) {
        return (
            <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
                {coefficient ?? "1"}
            </text>
        );
    }
    return (
        <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
            {coefficient !== undefined && coefficient !== "1" ? coefficient : ""}
            <tspan fontStyle="italic">x</tspan>
            {power !== 1 ? (
                <tspan dy={-fontSize * 0.42} fontSize={fontSize * 0.62}>
                    {power}
                </tspan>
            ) : null}
        </text>
    );
}

// ── A number tile the student can pick up ────────────────────────────────────

function NumberTile({
    value,
    index,
    onDrop,
    dragging,
    onDragStart,
    onDragMove,
    onDragEnd,
}: {
    value: number;
    index: number;
    dragging: boolean;
    onDrop: (point: Vec2, value: number) => void;
    onDragStart: (value: number, point: Vec2) => void;
    onDragMove: (point: Vec2) => void;
    onDragEnd: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const rectRef = useRef<SVGRectElement>(null);
    const scale = useSpring(dragging || hovered ? 1.12 : 1, { stiffness: 400, damping: 26 });
    const centre = tileCentre(index);

    const pointFrom = (event: React.PointerEvent) =>
        svgPointFromEvent(event, rectRef.current?.ownerSVGElement ?? null);

    return (
        <g>
            <g transform={`translate(${centre.x} ${centre.y}) scale(${scale})`} opacity={dragging ? 0.35 : 1}>
                <rect
                    x={-TILE_SIZE / 2}
                    y={-TILE_SIZE / 2}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    rx="9"
                    fill="#FFFFFF"
                    stroke={INK_STRUCTURE}
                    strokeWidth="1.5"
                    filter="url(#tile-shadow)"
                />
                <text
                    x="0"
                    y="6"
                    fontSize="18"
                    fill={INK}
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {value}
                </text>
            </g>
            <rect
                ref={rectRef}
                x={centre.x - TILE_SIZE / 2 - 6}
                y={centre.y - TILE_SIZE / 2 - 6}
                width={TILE_SIZE + 12}
                height={TILE_SIZE + 12}
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onDragStart(value, pointFrom(event));
                }}
                onPointerMove={(event) => {
                    if (!dragging) return;
                    onDragMove(pointFrom(event));
                }}
                onPointerUp={(event) => {
                    if (dragging) onDrop(pointFrom(event), value);
                    onDragEnd();
                }}
                onPointerCancel={onDragEnd}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
        </g>
    );
}

// ── The bespoke drawing ──────────────────────────────────────────────────────

function AnswerBuilderDrawing() {
    const setVar = useSetVar();
    const startPower = useVar<number>("ladderStartPower", DEFAULT_START);
    const powerBox = useVar<number>("assemblePower", 0);
    const divisorBox = useVar<number>("assembleDivisor", 0);

    const [drag, setDrag] = useState<{ value: number; x: number; y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const bothFilled = powerBox > 0 && divisorBox > 0;
    const checkPower = powerBox - 1;
    const checkCoefficient = formatRatio(powerBox, divisorBox || 1);
    const backAtStart = bothFilled && checkPower === startPower && powerBox === divisorBox;

    const handleDrop = (point: Vec2, value: number) => {
        if (isInsideSlot(point, POWER_SLOT)) setVar("assemblePower", value);
        else if (isInsideSlot(point, DIVISOR_SLOT)) setVar("assembleDivisor", value);
    };

    const renderSlot = (
        slot: { x: number; y: number; size: number; hue: string; tint: string },
        value: number,
        varName: string,
    ) => (
        <g>
            <rect
                x={slot.x}
                y={slot.y}
                width={slot.size}
                height={slot.size}
                rx="7"
                fill={value > 0 ? slot.tint : "#FFFFFF"}
                stroke={slot.hue}
                strokeWidth={value > 0 ? 2.5 : 1.5}
                strokeDasharray={value > 0 ? undefined : "4 4"}
                style={{ transition: "stroke-width 150ms ease", cursor: value > 0 ? "pointer" : "default" }}
                onClick={() => {
                    if (value > 0) setVar(varName, 0);
                }}
            />
            {value > 0 ? (
                <text
                    x={slot.x + slot.size / 2}
                    y={slot.y + slot.size / 2 + 7}
                    fontSize="19"
                    fill={slot.hue}
                    textAnchor="middle"
                    pointerEvents="none"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {value}
                </text>
            ) : null}
        </g>
    );

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="An integral answer template with two empty boxes and a tray of draggable number tiles"
        >
            <defs>
                <filter id="tile-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.22" />
                </filter>
            </defs>

            {/* The term you were handed. */}
            <text x="40" y="48" fontSize="11" fill={INK_STRUCTURE}>
                you are integrating
            </text>
            <Term x={140} y={112} power={startPower} fontSize={30} fill={GIVEN} />

            {/* The answer template — two boxes waiting for tiles. */}
            <text x="330" y="48" fontSize="11" fill={INK_STRUCTURE}>
                your answer
            </text>
            <text x="392" y="112" fontSize="30" fill={ACCENT} textAnchor="middle" fontStyle="italic">
                x
            </text>
            {renderSlot(POWER_SLOT, powerBox, "assemblePower")}
            <line
                x1={FRACTION_BAR.x1}
                y1={FRACTION_BAR.y}
                x2={FRACTION_BAR.x2}
                y2={FRACTION_BAR.y}
                stroke={ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {renderSlot(DIVISOR_SLOT, divisorBox, "assembleDivisor")}

            {/* The live check — differentiate whatever has been assembled. */}
            <text x="40" y="204" fontSize="11" fill={INK_STRUCTURE}>
                differentiate your answer and you get
            </text>
            {bothFilled ? (
                <Term
                    x={330}
                    y={208}
                    coefficient={checkCoefficient}
                    power={checkPower}
                    fontSize={22}
                    fill={backAtStart ? ACCENT : INK}
                />
            ) : (
                <text x={330} y={208} fontSize="14" fill={INK_QUIET} textAnchor="middle">
                    both boxes still empty
                </text>
            )}
            <text
                x="330"
                y="234"
                fontSize="13"
                fill={backAtStart ? ACCENT : INK_STRUCTURE}
                textAnchor="middle"
                style={{ transition: "fill 150ms ease" }}
            >
                {backAtStart
                    ? "back to the given term"
                    : bothFilled
                      ? "not the given term yet"
                      : ""}
            </text>

            {/* The tray. */}
            <text x="40" y="252" fontSize="11" fill={INK_STRUCTURE}>
                drag a number into each box
            </text>
            {TILE_VALUES.map((value, index) => (
                <NumberTile
                    key={value}
                    value={value}
                    index={index}
                    dragging={drag?.value === value}
                    onDrop={handleDrop}
                    onDragStart={(tileValue, point) => setDrag({ value: tileValue, x: point.x, y: point.y })}
                    onDragMove={(point) => setDrag((current) => (current ? { ...current, x: point.x, y: point.y } : current))}
                    onDragEnd={() => setDrag(null)}
                />
            ))}

            {/* The tile currently in the student's hand. */}
            {drag ? (
                <g transform={`translate(${drag.x} ${drag.y})`} pointerEvents="none">
                    <rect
                        x={-TILE_SIZE / 2}
                        y={-TILE_SIZE / 2}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        rx="9"
                        fill="#FFFFFF"
                        stroke={ACCENT}
                        strokeWidth="2.5"
                        filter="url(#tile-shadow)"
                    />
                    <text
                        x="0"
                        y="6"
                        fontSize="18"
                        fill={ACCENT}
                        textAnchor="middle"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {drag.value}
                    </text>
                </g>
            ) : null}
        </svg>
    );
}

function AnswerBuilderFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="integral-answer-builder"
            onReset={() => {
                setVar("assemblePower", 0);
                setVar("assembleDivisor", 0);
            }}
            caption="Drag a number tile into each coloured box, and tap a filled box to empty it again. The panel differentiates whatever you build."
        >
            <AnswerBuilderDrawing />
            <InteractionHintSequence
                hintKey="integral-answer-builder-tiles"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag a number tile up into the top box",
                        position: { x: "59%", y: "78%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: 18 }, endOffset: { x: 0, y: -22 } },
                    },
                    {
                        gesture: "drag",
                        label: "Now fill the box under the line",
                        position: { x: "31%", y: "78%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: 18 }, endOffset: { x: 0, y: -22 } },
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
                An integral answer has two blanks in it: a{" "}
                <InlineSpotColor
                    id="spot-power-ladder-setup-power"
                    varName="assemblePower"
                    {...spotColorPropsFromDefinition(getVariableInfo('assemblePower'))}
                >
                    new power
                </InlineSpotColor>
                , and a{" "}
                <InlineSpotColor
                    id="spot-power-ladder-setup-divisor"
                    varName="assembleDivisor"
                    {...spotColorPropsFromDefinition(getVariableInfo('assembleDivisor'))}
                >
                    number to divide by
                </InlineSpotColor>
                . The term waiting to be integrated is x to the power{" "}
                <InlineScrubbleNumber
                    varName="ladderStartPower"
                    {...numberPropsFromDefinition(getVariableInfo('ladderStartPower'))}
                />
                . Drag number tiles into the two coloured boxes, and the panel underneath
                differentiates whatever you build, so you can see whether it lands back on
                the given term.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-figure" maxWidth="xl">
        <Block id="power-ladder-figure" padding="sm" hasVisualization>
            <AnswerBuilderFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-worked" maxWidth="xl">
        <Block id="power-ladder-worked" padding="sm">
            <EditableParagraph id="para-power-ladder-worked" blockId="power-ladder-worked">
                <InlineTrigger
                    id="trigger-power-ladder-worked-given"
                    varName="ladderStartPower"
                    value={3}
                    color={GIVEN}
                    bgColor="rgba(142, 144, 245, 0.18)"
                >
                    Take x³
                </InlineTrigger>{" "}
                as the given term. The power box{" "}
                <InlineTrigger
                    id="trigger-power-ladder-worked-power"
                    varName="assemblePower"
                    value={4}
                    color={POWER_HUE}
                    bgColor="rgba(247, 178, 59, 0.18)"
                >
                    goes up one to 4
                </InlineTrigger>
                , and the divide-by box{" "}
                <InlineTrigger
                    id="trigger-power-ladder-worked-divisor"
                    varName="assembleDivisor"
                    value={4}
                    color={DIVISOR_HUE}
                    bgColor="rgba(248, 160, 205, 0.2)"
                >
                    takes that same 4
                </InlineTrigger>
                , giving{" "}
                <InlineFormula
                    id="formula-power-ladder-worked-answer"
                    latex="\frac{\clr{built}{x}^{\clr{power}{4}}}{\clr{divisor}{4}}"
                    colorMap={{ built: ACCENT, power: POWER_HUE, divisor: DIVISOR_HUE }}
                />
                . Differentiate that and the fours
                cancel, leaving{" "}
                <InlineFormula
                    id="formula-power-ladder-worked-given"
                    latex="\clr{given}{x^3}"
                    colorMap={{ given: GIVEN }}
                />{" "}
                exactly as it started.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-rule" maxWidth="xl">
        <Block id="power-ladder-rule" padding="lg">
            <FormulaBlock
                latex="\int \clr{given}{x^n} \, dx = \frac{\clr{built}{x}^{\clr{power}{n+1}}}{\clr{divisor}{n+1}}"
                colorMap={{ given: GIVEN, built: ACCENT, power: POWER_HUE, divisor: DIVISOR_HUE }}
                color="#334155"
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-power-ladder-question-power" maxWidth="xl">
        <Block id="power-ladder-question-power" padding="md">
            <EditableParagraph id="para-power-ladder-question-power" blockId="power-ladder-question-power">
                Try it on{" "}
                <InlineFormula
                    id="formula-power-ladder-question-given"
                    latex="\clr{given}{x^5}"
                    colorMap={{ given: GIVEN }}
                />
                . The tile that belongs in the power box is{" "}
                <InlineFeedback
                    varName="answer_ladder_power"
                    correctValue={["6", "six"]}
                    position="terminal"
                    successMessage="— yes, one step up from 5"
                    failureMessage="— not that one."
                    hint="Integrating always pushes the power up by exactly one"
                    visualizationHint={{
                        blockId: "power-ladder-figure",
                        hintKey: "answer-builder-discover",
                        label: "Build it and check",
                        steps: [
                            {
                                gesture: "drag",
                                label: "Drag tiles into the boxes until differentiating gives back x⁵",
                                position: { x: "86%", y: "78%" },
                                completionVar: "assemblePower",
                                completionValue: 6,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag",
                                label: "Now fill the lower box until the panel says you are back on the given term",
                                position: { x: "86%", y: "78%" },
                                completionVar: "assembleDivisor",
                                completionValue: 6,
                                completionTolerance: 0.4,
                            },
                        ],
                        resetVars: { ladderStartPower: 5, assemblePower: 0, assembleDivisor: 0 },
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
