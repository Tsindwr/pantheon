import React from "react";
import styles from "./SheetCard.module.css";

type SheetCardProps = {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function SheetCard({ title, eyebrow, actions, children, className }: SheetCardProps) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <div>
          {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
          <h3 className={styles.title}>{title}</h3>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
