import React, {
    useEffect,
    useState,
} from "react";
import type {
    AbilityBuilderNode,
} from "../../domain";
import type {
    PricingAttestationInput
} from "./AbilityBuilderContext";
import {
    useAbilityBuilderContext
} from "./AbilityBuilderContext";
import styles from "./AbilityBuilderShell.module.css";

type Props = {
    node: AbilityBuilderNode;
};

export default function PricingAttestationPanel({
    node
}: Props) {
    const {
        pricingAttestation,
    } = useAbilityBuilderContext();

    const [justification, setJustification] = useState("");
    const [evidence, setEvidence] = useState("");

    const kind: PricingAttestationInput["kind"] | null =
        node.type === "abilityRoot" && node.data.pricingBasis !== undefined ? "common_basis"
            : node.type === "marketModifier" && node.data.costOverride !== undefined ? "modifier_override"
            : null;

    useEffect(() => {
        setJustification("");
        setEvidence("");
    }, [node.id, pricingAttestation?.revision]);

    if (!pricingAttestation || !kind) return null;

    const existing = pricingAttestation.ready ?
        pricingAttestation.records.find(
            (record) => record.nodeId === node.id && record.kind === kind &&
                record.revision === pricingAttestation.revision,
    ) : undefined;

    const needsEvidence = kind === "common_basis";

    const canSubmit = pricingAttestation.ready && !pricingAttestation.busy &&
        !existing && justification.trim().length >= 24 && justification.trim().length <= 2000 &&
        (
            !needsEvidence || evidence.trim().length >= 24
        ) && evidence.trim().length <= 2000;

    return (
        <section className={styles.sidebarSection}
                 aria-label={"Administrator pricing attestation"}
        >
            <div className={styles.eyebrow}>
                Administrator Pricing Attestation
            </div>

            <p className={styles.sidebarCopy}>
                Record the reasoning for this exceptional price against the saved
                Ability revision. This does not authorize publication.
            </p>

            {existing ? (
                <div
                    className={styles.okay}
                    role={"status"}
                >
                    <strong>Attestation recorded</strong>

                    <p>
                        Saved revision{" "}
                        {existing.revision}
                    </p>

                    <p>
                        Document digest:{" "}
                        <code>
                            {existing.contentDigest.slice(0, 12)}...
                        </code>
                    </p>

                    <p>
                        Publication authorization remains pending.
                    </p>
                </div>
            ) : (
                <>
                    {!pricingAttestation.ready ? (
                        <p className={styles.warning}>
                            Save all changes before recording an administrator attestation.
                        </p>
                    ) : null}

                    <label className={styles.field}>
                        <span>Administrator Justification</span>

                        <textarea
                            value={justification}
                            maxLength={2000}
                            rows={4}
                            disabled={!pricingAttestation.ready || pricingAttestation.busy}
                            placeholder={"Explain why the exceptional price is appropriate."}
                            onChange={(event) =>
                                setJustification(event.target.value)
                            }
                        />
                    </label>

                    {needsEvidence ? (
                        <label className={styles.field}>
                            <span>Common Ability Source Evidence</span>

                            <textarea
                                value={evidence}
                                maxLength={2000}
                                rows={3}
                                disabled={!pricingAttestation.ready || pricingAttestation.busy}
                                placeholder={"Provide the original Common Ability reference, edition, " +
                                    "section or other source citation."}
                                onChange={(event) => setEvidence(event.target.value)}
                            />
                        </label>
                    ) : null}

                    <button
                        type={"button"}
                        className={styles.smallButton}
                        disabled={!canSubmit}
                        onClick={() => {
                            void pricingAttestation.onAttest({
                                nodeId: node.id,
                                kind,
                                justification: justification.trim(),
                                evidence: needsEvidence ? evidence.trim() : null,
                            });
                        }}
                    >
                        {pricingAttestation.busy ? "Recording..." : "Record Attestation"}
                    </button>
                </>
            )}

            {pricingAttestation.error ? (
                <div className={styles.warning}
                     role={"alert"}
                 >
                    {pricingAttestation.error}
                </div>
            ) : null}

            {pricingAttestation.status ? (
                <div className={styles.okay} role={"status"}>
                    {pricingAttestation.status}
                </div>
            ) : null}
        </section>
    );
}