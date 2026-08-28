/**
 * Section 2 — INTRODUCE: "The Undo Machine"
 *
 * Inversion paradigm: the student is shown the OUTPUT of differentiation and
 * must rebuild the input. Two dials inside the figure (coefficient and power)
 * drive a live derivative readout; the target card is fixed at 6x².
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
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, remap, useSpring, type Vec2 } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    numberPropsFromDefinition,
} from "../variables";

// ── Domain model ─────────────────────────────────────────────────────────────

const TARGET_COEFFICIENT = 6;
const TARGET_POWER = 2;
const DEFAULT_COEFFICIENT = 3;
const DEFAULT_POWER = 2;
const MIN_COEFFICIENT = 1;
const MAX_COEFFICIENT = 6;
const MIN_POWER = 1;
const MAX_POWER = 5;

// ── View constants ───────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 320;

const TRACK_LEFT = 60;
const TRACK_RIGHT = 190;
const COEFFICIENT_TRACK_Y = 232;
const POWER_TRACK_Y = 284;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const ACCENT = "#62D0AD";

// ── Term rendering (a single algebraic term as SVG text) ─────────────────────

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
    coefficient: number;
    power: number;
    fontSize: number;
    fill: string;
}) {
    if (power === 0) {
        return (
            <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
                {coefficient}
            </text>
        );
    }
    return (
        <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor="middle">
            {coefficient === 1 ? "" : coefficient}
            <tspan fontStyle="italic">x</tspan>
            {power !== 1 ? (
                <tspan dy={-fontSize * 0.42} fontSize={fontSize * 0.62}>
                    {power}
                </tspan>
            ) : null}
        </text>
    );
}

// ── A dial: a track with a draggable accent knob ─────────────────────────────

function Dial({
    label,
    value,
    min,
    max,
    trackY,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    trackY: number;
    onChange: (next: number) => void;
}) {
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const rectRef = useRef<SVGRectElement>(null);

    const targetX = remap(value, min, max, TRACK_LEFT, TRACK_RIGHT);
    const knobX = useSpring(targetX, { stiffness: 260, damping: 24 });
    const knobScale = useSpring(dragging || hovered ? 1.15 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const updateFromEvent = (event: React.PointerEvent<SVGRectElement>) => {
        const svg = rectRef.current?.ownerSVGElement ?? null;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const point: Vec2 = {
            x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        };
        const raw = remap(point.x, TRACK_LEFT, TRACK_RIGHT, min, max);
        onChange(clamp(Math.round(raw), min, max));
    };

    return (
        <g>
            <text x={TRACK_LEFT} y={trackY - 18} fontSize="11" fill={INK_STRUCTURE}>
                {label}
            </text>
            <text
                x={TRACK_RIGHT}
                y={trackY - 18}
                fontSize="12"
                fill={ACCENT}
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </text>
            <line
                x1={TRACK_LEFT}
                y1={trackY}
                x2={TRACK_RIGHT}
                y2={trackY}
                stroke={INK_QUIET}
                strokeWidth="4"
                strokeLinecap="round"
            />
            <g transform={`translate(${knobX} ${trackY}) scale(${knobScale})`}>
                <circle r="11" fill={ACCENT} filter="url(#undo-machine-shadow)" />
            </g>
            <rect
                ref={rectRef}
                x={TRACK_LEFT - 22}
                y={trackY - 20}
                width={TRACK_RIGHT - TRACK_LEFT + 44}
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

function UndoMachineDrawing() {
    const setVar = useSetVar();
    const coefficient = useVar<number>("undoCoefficient", DEFAULT_COEFFICIENT);
    const power = useVar<number>("undoPower", DEFAULT_POWER);

    // The model draws the view: the printed term IS the derivative.
    const outputCoefficient = coefficient * power;
    const outputPower = power - 1;
    const matches =
        outputCoefficient === TARGET_COEFFICIENT && outputPower === TARGET_POWER;

    return (
        <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A machine that differentiates the function built by two dials, next to a target result"
        >
            <defs>
                <filter id="undo-machine-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Target card — quiet ink, the thing to hit. */}
            <rect
                x="300"
                y="24"
                width="220"
                height="58"
                rx="10"
                fill="#FFFFFF"
                stroke={matches ? ACCENT : INK_QUIET}
                strokeWidth="1.5"
                strokeDasharray="5 5"
                style={{ transition: "stroke 150ms ease" }}
            />
            <text x="410" y="44" fontSize="10" fill={INK_STRUCTURE} textAnchor="middle">
                target
            </text>
            <Term x={410} y={72} coefficient={TARGET_COEFFICIENT} power={TARGET_POWER} fontSize={20} fill={INK} />

            {/* Input card — what the student builds. Accent: it is manipulable. */}
            <text x="125" y="88" fontSize="11" fill={INK_STRUCTURE} textAnchor="middle">
                your function
            </text>
            <rect x="40" y="96" width="170" height="76" rx="10" fill="#FFFFFF" stroke={ACCENT} strokeWidth="2.5" />
            <Term x={125} y={142} coefficient={coefficient} power={power} fontSize={26} fill={ACCENT} />

            {/* The machine: one arrow that only knows how to differentiate. */}
            <text x="255" y="118" fontSize="11" fill={INK_STRUCTURE} textAnchor="middle">
                differentiate
            </text>
            <line x1="218" y1="134" x2="286" y2="134" stroke={INK_STRUCTURE} strokeWidth="2" strokeLinecap="round" />
            <path d="M 286 134 L 276 128 M 286 134 L 276 140" stroke={INK_STRUCTURE} strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Output card — the machine's print-out. */}
            <text x="410" y="88" fontSize="11" fill={INK_STRUCTURE} textAnchor="middle">
                the machine prints
            </text>
            <rect x="300" y="96" width="220" height="76" rx="10" fill="#FFFFFF" stroke={INK_STRUCTURE} strokeWidth="1.5" />
            <Term x={410} y={142} coefficient={outputCoefficient} power={outputPower} fontSize={26} fill={matches ? ACCENT : INK} />

            {/* Verdict — beside nothing, below the print-out, never over it. */}
            <text
                x="410"
                y="232"
                fontSize="13"
                fill={matches ? ACCENT : INK_STRUCTURE}
                textAnchor="middle"
                style={{ transition: "fill 150ms ease" }}
            >
                {matches ? "matches the target" : "not the target yet"}
            </text>

            <Dial
                label="coefficient"
                value={coefficient}
                min={MIN_COEFFICIENT}
                max={MAX_COEFFICIENT}
                trackY={COEFFICIENT_TRACK_Y}
                onChange={(next) => setVar("undoCoefficient", next)}
            />
            <Dial
                label="power"
                value={power}
                min={MIN_POWER}
                max={MAX_POWER}
                trackY={POWER_TRACK_Y}
                onChange={(next) => setVar("undoPower", next)}
            />
        </svg>
    );
}

function UndoMachineFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="undo-machine"
            onReset={() => {
                setVar("undoCoefficient", DEFAULT_COEFFICIENT);
                setVar("undoPower", DEFAULT_POWER);
            }}
            caption="The machine differentiates whatever you build. Drag the two teal dials until its print-out matches the dashed target."
        >
            <UndoMachineDrawing />
            <InteractionHintSequence
                hintKey="undo-machine-dials"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the power dial",
                        position: { x: "17%", y: "88%" },
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

export const undoMachineBlocks: ReactElement[] = [
    <StackLayout key="layout-undo-machine-heading" maxWidth="xl">
        <Block id="undo-machine-heading" padding="md">
            <EditableH2 id="h2-undo-machine-heading" blockId="undo-machine-heading">
                The Undo Machine
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-undo-machine-setup" maxWidth="xl">
        <Block id="undo-machine-setup" padding="sm">
            <EditableParagraph id="para-undo-machine-setup" blockId="undo-machine-setup">
                This machine only knows one trick: whatever function goes in, its derivative
                comes out. Drag the two teal dials to build a function with coefficient{" "}
                <InlineScrubbleNumber
                    varName="undoCoefficient"
                    {...numberPropsFromDefinition(getVariableInfo('undoCoefficient'))}
                />{" "}
                and power{" "}
                <InlineScrubbleNumber
                    varName="undoPower"
                    {...numberPropsFromDefinition(getVariableInfo('undoPower'))}
                />
                , and hunt for the pair that makes the machine print exactly 6x².
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-undo-machine-figure" maxWidth="xl">
        <Block id="undo-machine-figure" padding="sm" hasVisualization>
            <UndoMachineFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-undo-machine-insight" maxWidth="xl">
        <Block id="undo-machine-insight" padding="sm">
            <EditableParagraph id="para-undo-machine-insight" blockId="undo-machine-insight">
                Finding those dials means you have integrated: you started from a derivative
                and recovered the function behind it. The power you needed sat one step above
                the target's power, and the coefficient came out smaller, not bigger. Those
                two moves are the whole recipe.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-undo-machine-question" maxWidth="xl">
        <Block id="undo-machine-question" padding="md">
            <EditableParagraph id="para-undo-machine-question" blockId="undo-machine-question">
                Same machine, new day. Today it prints 5x⁴, so the function you fed it was{" "}
                <InlineFeedback
                    varName="answer_undo_reverse"
                    correctValue={["x^5", "x⁵", "x5"]}
                    position="terminal"
                    successMessage="— exactly, and it checks out: the power 5 drops down to 4 and lands in front as the 5"
                    failureMessage="— not there yet."
                    hint="The power you want sits one step above 4"
                    visualizationHint={{
                        blockId: "undo-machine-figure",
                        hintKey: "undo-machine-discover",
                        label: "Test it on the machine",
                        steps: [
                            {
                                gesture: "drag-horizontal",
                                label: "Drag the power dial all the way to 5",
                                position: { x: "17%", y: "88%" },
                                completionVar: "undoPower",
                                completionValue: 5,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Now drag the coefficient dial down until the print-out reads 5x⁴",
                                position: { x: "20%", y: "72%" },
                                completionVar: "undoCoefficient",
                                completionValue: 1,
                                completionTolerance: 0.4,
                            },
                        ],
                        resetVars: { undoPower: 2, undoCoefficient: 3 },
                    }}
                >
                    <InlineClozeInput
                        varName="answer_undo_reverse"
                        correctAnswer={["x^5", "x⁵", "x5"]}
                        {...clozePropsFromDefinition(getVariableInfo('answer_undo_reverse'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
