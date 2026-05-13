import React, { useEffect, useRef, useState } from 'react';
import DiceBox from "@3d-dice/dice-box";
import type {PotentialKey, PotentialState} from '../../types/sheet.ts';
import styles from '../roll/SunderDiceBoxOverlay.module.css';
import {routes} from "../../lib/routing.ts";

export type BuilderPotentialRollRequest = {
    potentialKey: PotentialKey;
    potentialLabel: string;
};

type BuilderPotentialRollerProps = {
    request: BuilderPotentialRollRequest | null;
    open: boolean;
    onClose: () => void;
    onApply: (result: { potentialKey: PotentialKey; total: number; rolls: number[] }) => void;
};

type Phase = "idle" | "rolling" | "resolved" | "error";

export default function BuilderPotentialRoller({
    request,
    open,
    onClose,
    onApply,
}: BuilderPotentialRollerProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const diceBoxRef = useRef<DiceBox | null>(null);

    const [phase, setPhase] = useState<Phase>("idle");
    const [boxReady, setBoxReady] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [rolls, setRolls] = useState<number[]>([]);
    const [dropped, setDropped] = useState<number | null>(null);
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function initBox() {
            if (!open || !request) return;
            if (!hostRef.current) return;

            if (diceBoxRef.current) {
                if (!boxReady) setBoxReady(true);
                return;
            }

            try {
                const box = new DiceBox({
                    assetPath: routes.assetsPath("/dice-box/"),
                    container: "#builder-dice-stage",
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
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "DiceBox init failed.");
                setPhase("error");
            }
        }

        void initBox();

        return () => {
            cancelled = true;
        };
    }, [open, request, boxReady]);

    useEffect(() => {
        let cancelled = false;

        async function runRoll() {
            if (!open || !request || !boxReady || !diceBoxRef.current) return;

            setPhase("rolling");
            setErrorText(null);
            setRolls([]);
            setDropped(null);
            setTotal(null);

            try {
                diceBoxRef.current.clear();

                const rawResults = await diceBoxRef.current.roll(
                    [{ qty: 3, sides: 4}],
                    { newStartPoint: true},
                );

                if (cancelled) return;

                const nextRolls = (Array.isArray(rawResults) ? rawResults : [])
                    .map((entry: any) => Number(entry?.value ?? entry?.result ?? 0))
                    .filter((value) => Number.isFinite(value) && value > 0);

                if (nextRolls.length !== 3) {
                    throw new Error("Expected exactly 3 results.");
                }

                let nextDropped = Math.max(...nextRolls);
                let nextTotal = nextRolls.reduce((sum, value) => sum + value, 0) - nextDropped;

                // check if all values in nextRolls are 1
                if (nextRolls.every((value) => value === 1)) {
                    nextTotal = 1;
                }

                setRolls(nextRolls);
                setDropped(nextDropped);
                setTotal(nextTotal);
                setPhase("resolved");
            } catch (error) {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "Roll failed unexpectedly.");
                setPhase("error");
            }
        }

        void runRoll();

        return () => {
            cancelled = true;
        };
    }, [open, request, boxReady]);

    if (!open || !request) return null;

    return (
        <div className={styles.overlay} role={'dialog'} aria-modal={'true'}>
            <button
                type={'button'}
                className={styles.scrim}
                aria-label={'Close potential roll overlay'}
                onClick={onClose}
            />
            <div
                id={'builder-dice-stage'}
                ref={hostRef}
                className={styles.diceStage}
                aria-hidden={'true'}
            />

            <div className={styles.hud}>
                <section className={styles.card}>
                    {phase === 'rolling' ? (
                        <>
                            <div className={styles.eyebrow}>Potential roll</div>
                            <h2 className={styles.title}>Rolling 3d4, drop highest...</h2>
                        </>
                    ) : null}

                    {phase === 'error' ? (
                        <>
                            <div className={styles.eyebrow}>Potential roll</div>
                            <h2 className={styles.title}>Roll failed</h2>
                            <p className={styles.copy}>{errorText ?? "Unknown error."}</p>
                            <button type={'button'} className={styles.close} onClick={onClose}>
                                Close
                            </button>
                        </>
                    ) : null}

                    {phase === 'resolved' && total !== null ? (
                        <>
                            <header className={styles.header}>
                                <div>
                                    <div className={styles.eyebrow}>Potential roll</div>
                                    <h2 className={styles.title}>{request.potentialLabel}</h2>
                                    <p className={styles.meta}>
                                        <span>3d4</span>
                                        <span>Drop highest</span>
                                    </p>
                                </div>

                                <button type={'button'} className={styles.close} onClick={onClose}>
                                    Cancel
                                </button>
                            </header>

                            <div className={styles.resultRow}>
                                <div className={styles.resultCell}>
                                    <span>Rolls</span>
                                    <strong>{rolls.join(" · ")}</strong>
                                    <em>All dice</em>
                                </div>

                                <div className={styles.resultCell}>
                                    <span>Dropped</span>
                                    <strong>{dropped}</strong>
                                    <em>Highest die</em>
                                </div>

                                <div className={styles.resultCell}>
                                    <span>Total</span>
                                    <strong>{total}</strong>
                                    <em>Base score</em>
                                </div>
                            </div>

                            <div className={styles.pool}>
                                {rolls.map((value, index) => (
                                    <span key={`${value}-${index}`} className={styles.poolDie}>
                                        {value}
                                    </span>
                                ))}
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                                <button
                                    type={'button'}
                                    className={styles.close}
                                    onClick={() => {
                                        onApply({
                                            potentialKey: request?.potentialKey,
                                            total,
                                            rolls,
                                        })
                                    }}
                                    >
                                    Apply {total}
                                </button>
                            </div>
                        </>
                    ) : null}
                </section>
            </div>
        </div>
    );
}