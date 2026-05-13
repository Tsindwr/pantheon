import React, { useRef, useState, useCallback, cloneElement } from "react";
import styles from "./Tooltip.module.css";

type Placement = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  /** Content displayed inside the tooltip bubble. */
  content: React.ReactNode;
  /** Hover delay in ms before the tooltip appears (default 500). */
  delay?: number;
  /** Where the bubble appears relative to the child (default "top"). */
  placement?: Placement;
  children: React.ReactElement;
};

/**
 * Speech-bubble tooltip with configurable hover delay.
 * Wrap any inline element to give it a tooltip on hover/focus.
 */
export default function Tooltip({
  content,
  delay = 500,
  placement = "top",
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const childWithHandlers = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      children.props.onBlur?.(e);
    },
  });

  return (
    <span className={styles.wrapper}>
      {childWithHandlers}
      {visible ? (
        <span className={`${styles.bubble} ${styles[placement]}`} role="tooltip">
          {content}
          <span className={styles.arrow} aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}
