import React, { useEffect } from "react";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  /** CSS width value, e.g. "360px" or "40vw" */
  width?: string;
  /**
   * When false, the sidebar slides in without a dimming backdrop,
   * so the rest of the page remains interactive. Default: true.
   */
  modal?: boolean;
};

/**
 * Generic sliding side-panel.
 * Fill with inventory editing, roll history, character management, etc.
 */
export default function Sidebar({
  open,
  onClose,
  title,
  children,
  width = "360px",
  modal = true,
}: SidebarProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Dimming overlay — only rendered in modal mode */}
      {modal && (
        <div
          className={[styles.backdrop, open ? styles.backdropOpen : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={[styles.panel, open ? styles.panelOpen : ""]
          .filter(Boolean)
          .join(" ")}
        style={{ "--sidebar-width": width } as React.CSSProperties}
        aria-modal={open && modal ? "true" : "false"}
        aria-label={title ?? "Side panel"}
        hidden={!open}
      >
        <div className={styles.panelHeader}>
          {title ? <h2 className={styles.panelTitle}>{title}</h2> : <span />}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className={styles.panelBody}>{children}</div>
      </aside>
    </>
  );
}
