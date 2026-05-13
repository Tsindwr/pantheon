import React, {useEffect, useMemo, useRef, useState } from 'react';
import DiceBox from '@3d-dice/dice-box';
import type { CharacterSheetState, RollComposerDraft } from "../../types/sheet.ts";
import {
    buildVolatilityPoolState,
    resolveObservedSunderRoll,
    resolveSunderRoll
} from "../../lib/rolling/resolveSunderRoll.ts";
import type { TestResult } from "../../lib/rolling/types.ts";
import {
    buildDisplayRollMeta,
    buildTestStateFromDraft,
    type DisplayRoll,
} from "./rollDisplay.ts";
import { getVolatilityPlan } from "../../lib/rolling/resolveVolatility.ts"
import { parseDiceBoxResults } from "./diceBoxAdapter.ts";
import SunderRollOverlay from "./SunderRollOverlay.tsx";
import SunderDiceBoxOverlay from "./SunderDiceBoxOverlay.tsx";

type DiceRollerProps = {
    sheet: CharacterSheetState;
    request: RollComposerDraft | null;
    onClose: () => void;
    onResolved?: (result: TestResult) => void;
};

export type RollPhase = 'idle' | 'rolling' | 'resolved' | 'error';

export default function DiceRoller({
    sheet,
    request,
    onClose,
    onResolved,
}: DiceRollerProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const diceBoxRef = useRef<DiceBox | null>(null);
    const onResolvedRef = useRef<typeof onResolved>(onResolved);

    useEffect(() => {
        onResolvedRef.current = onResolved;
    }, [onResolved])

    const [phase, setPhase] = useState<RollPhase>('idle');
    const [displayRoll, setDisplayRoll] = useState<DisplayRoll | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [boxReady, setBoxReady] = useState(false);

    const prepared = useMemo(() => {
        if (!request) return null;

        const testState = buildTestStateFromDraft(sheet, request);
        const meta = buildDisplayRollMeta(sheet, request);
        const volatilityPool = buildVolatilityPoolState(testState);
        const plan = getVolatilityPlan(volatilityPool);

        return { testState, meta, plan };
    }, [request, sheet]);

    useEffect(() => {
        console.log("DiceRoller state", {
            hasRequest: Boolean(request),
            hasPrepared: Boolean(prepared),
            boxReady,
            hasBox: Boolean(diceBoxRef.current),
            phase,
        });
    }, [request, prepared, boxReady, phase]);

    useEffect(() => {
        let cancelled = false;

        async function initBox() {
            if (!request) return;
            if (!hostRef.current) return;
            if (diceBoxRef.current) {
                if (!boxReady) setBoxReady(true);
                return;
            }

            console.log("initBox", {
                hasRequest: Boolean(request),
                hasHost: Boolean(hostRef.current),
                hasBox: Boolean(diceBoxRef.current),
            });

            try {
                const box = new DiceBox({
                    assetPath: `${import.meta.env.BASE_URL}/assets/dice-box/`,
                    container: "#sunder-dice-stage",
                    offscreen: false,
                    theme: "default",
                    themeColor: "#d2b24c",
                    scale: 7,
                    gravity: 1,
                    throwForce: 5,
                    spinForce: 4,
                    shadowTransparency: 0.75,
                    lightIntensity: 1.15,
                });

                await box.init();

                if (cancelled) return;
                diceBoxRef.current = box;
                setBoxReady(true);
            } catch (error) {
                console.error("DiceBox init failed:", error);
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "DiceBox init failed.");
                setPhase("error");
            }
        }

        initBox();

        return () => {
            cancelled = true;
        };
    }, [request, hostRef, boxReady]);

    useEffect(() => {
        let cancelled = false;

        async function runRoll() {
            if (!prepared || !boxReady || !diceBoxRef.current) return;
            console.log("runRoll invoked", { prepared, boxReady, hasBox: Boolean(diceBoxRef.current) });


            setPhase("rolling");
            setErrorText(null);
            setDisplayRoll(null);

            try {
                const notation: Array<{ qty: number; sides: number }> = [{ qty:1, sides:20 }];

                if (prepared.plan.diceCount > 0) {
                    notation.push({
                        qty: prepared.plan.diceCount,
                        sides: prepared.testState.dV,
                    });
                }

                diceBoxRef.current.clear();

                const rawResults = await diceBoxRef.current.roll(notation, {
                    newStartPoint: true,
                });

                if (cancelled) return;

                const observed = parseDiceBoxResults(
                    rawResults,
                    prepared.testState.dV,
                    prepared.plan.diceCount,
                );

                const result = resolveObservedSunderRoll(prepared.testState, observed);

                const nextDisplay: DisplayRoll = {
                    meta: prepared.meta,
                    result,
                };

                setDisplayRoll(nextDisplay);
                setPhase("resolved");
                onResolvedRef.current?.(result);

                console.log("runRoll end", {
                    hasPrepared: Boolean(prepared),
                    boxReady,
                    hasBox: Boolean(diceBoxRef.current),
                    diceCount: prepared?.plan.diceCount,
                });
            } catch (error) {
                console.error(error);
                if (cancelled) return;
                setErrorText(
                    error instanceof Error ? error.message : "Roll failed unexpectedly.",
                );
                setPhase("error");
            }
        }

        runRoll();

        return () => {
            cancelled = true;
        };
    }, [prepared, boxReady]);

    return (
        <SunderDiceBoxOverlay
            roll={displayRoll}
            open={Boolean(request) || phase === "rolling" || phase === "resolved" || phase === "error"}
            phase={phase}
            errorText={errorText}
            hostRef={hostRef}
            onClose={() => {
                setDisplayRoll(null);
                setErrorText(null);
                setPhase("idle");

                diceBoxRef.current = null;
                setBoxReady(false);

                onClose();
            }}
        />
    );
}