import React, {
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import type {
    CampaignCreationInput,
} from "../../application/library/campaign-creation-attempt.ts";
import styles from "./CampaignCreateDialog.module.css";

export type CampaignCreateDialogProps = {
    open: boolean;
    busy: boolean;
    onDismiss(): void;
    onCreate(input: CampaignCreationInput): void;
}

export default function CampaignCreateDialog({
    open,
    busy,
    onDismiss,
    onCreate,
}: CampaignCreateDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const nameId = useId();
    const gmId = useId();
    const pitchId = useId();

    const [name, setName] = useState("");
    const [gmName, setGmName] = useState("");
    const [pitch, setPitch] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open) {
            setName("");
            setGmName("");
            setPitch("");
            setValidationError(null);

            if (!dialog.open) {
                dialog.showModal();
            }
        } else if (dialog.open) {
            dialog.close();
        }

        return () => {
            if (dialog.open) {
                dialog.close();
            }
        };
    }, [open]);

    function dismiss() {
        if (!busy) {
            onDismiss();
        }
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        const normalizedName = name.trim();
        const normalizedGm = gmName.trim();
        const normalizedPitch = pitch.trim();

        if (!normalizedName) {
            setValidationError("Enter a campaign name before continuing.");
            return;
        }

        setValidationError(null);

        onCreate({
            name: normalizedName,
            ...(normalizedGm ? { gmName: normalizedGm } : {}),
            ...(normalizedPitch ? { pitch: normalizedPitch } : {})
        });
    }

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={(event) => {
                event.preventDefault();
                dismiss();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    dismiss();
                }
            }}
        >
            <form
                className={styles.panel}
                onSubmit={handleSubmit}
                noValidate
            >
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>
                            Campaign Creation
                        </div>

                        <h2 id={titleId}>
                            Create a campaign
                        </h2>
                    </div>

                    <button
                        type={"button"}
                        className={styles.closeButton}
                        aria-label={"Close campaign creation"}
                        onClick={dismiss}
                        disabled={busy}
                    >
                        <i
                            className={"fa-solid fa-xmark"}
                            aria-hidden={"true"}
                        />
                    </button>
                </header>

                <div className={styles.body}>
                    <p
                        className={styles.description}
                        id={descriptionId}
                    >
                        Give you campaign a name and, optionally, introduce
                        its Game Master and premise.
                    </p>

                    <div className={styles.field}>
                        <label htmlFor={nameId}>
                            Campaign name
                            <span
                                className={styles.required}
                                aria-hidden={"true"}
                            >
                                *
                            </span>
                        </label>

                        <input
                            id={nameId}
                            type={"text"}
                            value={name}
                            autoFocus
                            autoComplete={"off"}
                            maxLength={100}
                            required
                            aria-required={"true"}
                            aria-invalid={Boolean(validationError)}
                            aria-describedby={
                                validationError
                                    ? `${descriptionId} ${nameId}-error`
                                    : descriptionId
                            }
                            placeholder={"Name your campaign"}
                            disabled={busy}
                            onChange={(event) => {
                                setName(event.target.value);
                                setValidationError(null);
                            }}
                        />

                        {validationError && (
                            <p
                                id={`${nameId}-error`}
                                className={styles.validation}
                                role={"alert"}
                            >
                                {validationError}
                            </p>
                        )}
                    </div>

                    <div className={styles.field}>
                        <label htmlFor={gmId}>
                            Game Master
                            <span className={styles.optional}>
                                Optional
                            </span>
                        </label>

                        <input
                            id={gmId}
                            type={"text"}
                            value={gmName}
                            maxLength={100}
                            autoComplete={"off"}
                            placeholder={"Name or title"}
                            disabled={busy}
                            onChange={(event) => setGmName(event.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor={pitchId}>
                            Campaign premise
                            <span className={styles.optional}>
                                Optional
                            </span>
                        </label>

                        <textarea
                            id={pitchId}
                            value={pitch}
                            maxLength={1000}
                            rows={4}
                            placeholder={"What adventures await?"}
                            disabled={busy}
                            onChange={(event) => setPitch(event.target.value)}
                        />
                    </div>
                </div>

                <footer className={styles.footer}>
                    <button
                        type={"button"}
                        className={styles.secondary}
                        onClick={dismiss}
                        disabled={busy}
                    >
                        Cancel
                    </button>

                    <button
                        type={"submit"}
                        className={styles.primary}
                        disabled={busy || !name.trim()}
                    >
                        {busy ? "Creating..." : "Create Campaign"}
                    </button>
                </footer>
            </form>
        </dialog>
    );
}