import React, { useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "success" | "error";

type ClipboardButtonProps = {
    value?: string | null;
    label?: string;
    successLabel?: string;
    failureLabel?: string;
    className?: string;
};

export default function ClipboardButton({
    value,
    label = "Copy",
    successLabel = "Copied",
    failureLabel = "Copy failed",
    className,
}: ClipboardButtonProps) {
    const [status, setStatus] = useState<CopyStatus>("idle");
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimer.current) {
                clearTimeout(resetTimer.current);
            }
        };
    }, []);

    function queueReset() {
        if (resetTimer.current) {
            clearTimeout(resetTimer.current);
        }

        resetTimer.current = setTimeout(() => {
            setStatus("idle");
            resetTimer.current = null;
        }, 1600);
    }

    async function copyValue() {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            setStatus("success");
        } catch {
            setStatus("error");
        }

        queueReset();
    }

    const visibleLabel =
        status === "success" ? successLabel : status === "error" ? failureLabel : label;
    const iconClass =
        status === "success"
            ? "fa-circle-check"
            : status === "error"
              ? "fa-circle-exclamation"
              : "fa-copy";

    return (
        <button
            type="button"
            className={className}
            onClick={copyValue}
            disabled={!value}
            data-copy-status={status}
            aria-label={visibleLabel}
        >
            <i className={`fa-solid ${iconClass}`} aria-hidden="true" />
            <span aria-live="polite">{visibleLabel}</span>
        </button>
    );
}
