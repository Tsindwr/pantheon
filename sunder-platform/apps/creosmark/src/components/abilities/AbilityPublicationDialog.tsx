import React, {
    useEffect,
    useId,
    useRef,
} from "react";
import styles from "../library/CampaignCreateDialog.module.css";

type AbilityPublicationDialogProps = {
    open: boolean;
    busy: boolean;
    revision: number;
    abilityTitle: string;
    priceLabel: string;
    canConfirm: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function AbilityPublicationDialog({
    open,
    busy,
    revision,
    abilityTitle,
    priceLabel,
    canConfirm,
    onCancel,
    onConfirm,
}: AbilityPublicationDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }

        return () => {
            if (dialog.open) dialog.close();
        };
    }, [open]);

    function dismiss() {
        if (!busy) onCancel();
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
            <div className={styles.panel}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>
                            Standard Ability Library
                        </div>

                        <h2 id={titleId}>
                            Approve &amp; Publish
                        </h2>
                    </div>

                    <button
                        type={"button"}
                        className={styles.closeButton}
                        onClick={dismiss}
                        disabled={busy}
                        aria-label={"Cancel publication"}
                    >
                        <i className={"fa-solid fa-xmark"} aria-hidden={"true"} />
                    </button>
                </header>

                <div className={styles.body}>
                    <p className={styles.description} id={descriptionId}>
                        You are approving the saved version of this Ability for the Standard Ability Library.
                    </p>

                    <div>
                        <strong>{abilityTitle}</strong>
                    </div>

                    <div>
                        <span className={styles.eyebrow}>
                            Saved Revision
                        </span>

                        <div>{revision}</div>
                    </div>

                    <div>
                        <span className={styles.eyebrow}>
                            Purchase Price
                        </span>

                        <div>{priceLabel}</div>
                    </div>

                    <p className={styles.description}>
                        Publication creates an immutable approval audit record. Unsaved edits are never included.
                        This operation cannot be undone through the editor.
                    </p>

                    {!canConfirm ? (
                        <p className={styles.validation} role={"alert"}>
                            Resolve blocking validation issues and save your changes before publishing.
                        </p>
                    ) : null}
                </div>

                <footer className={styles.footer}>
                    <button
                        type={"button"}
                        className={styles.secondary}
                        onClick={dismiss}
                        disabled={busy}
                        autoFocus
                    >
                        Return to Editor
                    </button>

                    <button
                        type={"button"}
                        className={styles.primary}
                        onClick={onConfirm}
                        disabled={busy || !canConfirm}
                        data-testid={"ability-approval-action"}
                    >
                        {busy ? "Publishing..." : "Confirm Publication"}
                    </button>
                </footer>
            </div>
        </dialog>
    );
}