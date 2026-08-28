/**
 * Section 5 — CONCLUSION (text only)
 * Keeps the promise the opening made and points at what comes next.
 */

import { type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const integrationWrapUpBlocks: ReactElement[] = [
    <StackLayout key="layout-integration-wrapup-heading" maxWidth="xl">
        <Block id="integration-wrapup-heading" padding="md">
            <EditableH2 id="h2-integration-wrapup-heading" blockId="integration-wrapup-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-integration-wrapup-recap" maxWidth="xl">
        <Block id="integration-wrapup-recap" padding="sm">
            <EditableParagraph id="para-integration-wrapup-recap" blockId="integration-wrapup-recap">
                You can now answer the machine's backwards question. Given a derivative,
                climb one rung up the power ladder, divide by the power you land on, and add
                a constant, because the stack of curves you dragged all share one steepness
                graph. Differentiating and integrating are the same road travelled in
                opposite directions.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-integration-wrapup-next" maxWidth="xl">
        <Block id="integration-wrapup-next" padding="sm">
            <EditableParagraph id="para-integration-wrapup-next" blockId="integration-wrapup-next">
                The next step is choosing which curve from the family you actually want. Tell
                the integral one point it must pass through, as you did with the origin, and
                C stops being a mystery letter. From there, integration starts measuring real
                things: areas under curves, distance from speed, water collected from a flow.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
