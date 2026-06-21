import React from "react";
import styles from "./SectionTabs.module.css";

type Tab = {
  id: string;
  label: string;
};

type SectionTabsProps = {
  tabs: readonly Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  action?: React.ReactNode;
};

export default function SectionTabs({ tabs, activeTab, onChange, action }: SectionTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Character sheet sections">
      <div className={styles.tabList}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={[styles.tab, active ? styles.active : ""].filter(Boolean).join(" ")}
              onClick={() => onChange(tab.id)}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {action ? <div className={styles.actions}>{action}</div> : null}
    </nav>
  );
}
