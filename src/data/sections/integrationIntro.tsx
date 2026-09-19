/**
 * Section 1 — ORIENT (text only)
 * Opens the lesson, names the promise, and leans on the one prerequisite
 * the teacher confirmed: the power rule for differentiation.
 */

import { type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import { EditableH1, EditableParagraph, InlineFormula, InlineTooltip } from "@/components/atoms";

// Lesson-wide hues: the function you are hunting for is teal, the derivative
// you are handed is indigo (the same pair every later figure draws).
const FUNCTION_HUE = "#62D0AD";
const DERIVATIVE_HUE = "#8E90F5";

export const integrationIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-integration-intro-title" maxWidth="xl">
        <Block id="integration-intro-title" padding="md">
            <EditableH1 id="h1-integration-intro-title" blockId="integration-intro-title">
                Integration: Running Differentiation Backwards
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-integration-intro-hook" maxWidth="xl">
        <Block id="integration-intro-hook" padding="sm">
            <EditableParagraph id="para-integration-intro-hook" blockId="integration-intro-hook">
                Think of a vending machine that sells one thing only: derivatives. You feed
                it{" "}
                <InlineFormula
                    id="formula-integration-intro-fed"
                    latex="\clr{fn}{x^3}"
                    colorMap={{ fn: FUNCTION_HUE }}
                />{" "}
                and it hands back{" "}
                <InlineFormula
                    id="formula-integration-intro-returned"
                    latex="\clr{deriv}{3x^2}"
                    colorMap={{ deriv: DERIVATIVE_HUE }}
                />
                , which is just the{" "}
                <InlineTooltip
                    id="tooltip-integration-intro-power-rule"
                    tooltip="To differentiate a power of x, bring the power down in front and lower the power by one."
                    color="#2563EB"
                    bgColor="rgba(37, 99, 235, 0.12)"
                >
                    power rule
                </InlineTooltip>{" "}
                you already know. Now picture the machine handing you{" "}
                <InlineFormula
                    id="formula-integration-intro-handed"
                    latex="\clr{deriv}{3x^2}"
                    colorMap={{ deriv: DERIVATIVE_HUE }}
                />{" "}
                first and asking what you paid with.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-integration-intro-promise" maxWidth="xl">
        <Block id="integration-intro-promise" padding="sm">
            <EditableParagraph id="para-integration-intro-promise" blockId="integration-intro-promise">
                That backwards question is integration, and answering it is the other half
                of calculus. In the next few minutes you will run the power rule in reverse
                yourself, pin down the two steps that undo it, and find out why a backwards
                answer is never one curve but a whole family of them.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
