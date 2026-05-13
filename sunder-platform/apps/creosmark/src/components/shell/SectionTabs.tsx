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
};

export default function SectionTabs({ tabs, activeTab, onChange }: SectionTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Character sheet sections">
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
    </nav>
  );
}
