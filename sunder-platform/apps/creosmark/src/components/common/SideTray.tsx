import React, { useEffect, useId } from "react";
import styles from "./SideTray.module.css";

type SideTrayProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  id?: string;
  side?: "left" | "right";
  width?: string;
  modal?: boolean;
  topOffset?: string;
  bottomOffset?: string;
  zIndex?: number;
  ariaLabel?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onBack?: () => void;
  backLabel?: string;
  closeLabel?: string;
  bodyClassName?: string;
  panelClassName?: string;
  showHeader?: boolean;
};

export default function SideTray({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  id,
  side = "right",
  width = "min(430px, calc(100vw - 2rem))",
  modal = true,
  topOffset = modal ? "0px" : "5.75rem",
  bottomOffset = modal ? "0px" : "1rem",
  zIndex = modal ? 200 : 31,
  ariaLabel,
  triggerRef,
  onBack,
  backLabel = "Back",
  closeLabel = "Close",
  bodyClassName,
  panelClassName,
  showHeader = true,
}: SideTrayProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const cssVars = {
    "--side-tray-width": width,
    "--side-tray-top": topOffset,
    "--side-tray-bottom": bottomOffset,
    "--side-tray-z-index": zIndex,
  } as React.CSSProperties;

  return (
    <div
      className={[
        styles.layer,
        modal ? styles.layerModal : styles.layerInline,
        styles[side],
      ].join(" ")}
      style={cssVars}
      id={id ? `${id}-layer` : undefined}
    >
      {modal ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label={closeLabel}
          onClick={onClose}
        />
      ) : (
        <button
          type="button"
          className={styles.inlineClickAway}
          aria-label={closeLabel}
          onPointerDown={(event) => {
            const path = event.nativeEvent.composedPath();
            if (triggerRef?.current && path.includes(triggerRef.current)) return;
            onClose();
          }}
        />
      )}

      <aside
        id={id}
        className={[
          styles.panel,
          !showHeader ? styles.noHeader : "",
          panelClassName ?? "",
        ].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal={modal ? "true" : "false"}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {showHeader ? (
          <header className={[styles.header, onBack ? styles.hasBack : ""].filter(Boolean).join(" ")}>
            {onBack ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={onBack}
                aria-label={backLabel}
                title={backLabel}
              >
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              </button>
            ) : null}

            <div className={styles.titleBlock}>
              {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            </div>

            <button
              type="button"
              className={styles.iconButton}
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </header>
        ) : null}

        <div className={[styles.body, bodyClassName ?? ""].filter(Boolean).join(" ")}>
          {children}
        </div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </aside>
    </div>
  );
}
