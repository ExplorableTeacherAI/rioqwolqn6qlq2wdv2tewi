/**
 * Section 1 — ORIENT (text only)
 * Opens the lesson, names the promise, and leans on the one prerequisite
 * the teacher confirmed: the power rule for differentiation.
 */

import { type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import { EditableH1, EditableParagraph } from "@/components/atoms";

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
                it x³ and it hands back 3x², which is just the power rule you already know.
                Now picture the machine handing you 3x² first and asking what you paid
                with.
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
