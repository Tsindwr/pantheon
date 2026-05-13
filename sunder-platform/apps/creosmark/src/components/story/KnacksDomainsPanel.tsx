import React from 'react';
import styles from "./KnacksDomainsPanel.module.css";
import type { DomainState, KnackState } from "../../types/sheet";
import type {DomainData} from "../../lib/sheet-data.ts";

type KnacksDomainsPanelProps = {
    domains: DomainData[];
    knacks: KnackState[];
};

export default function KnacksDomainsPanel({
   domains,
   knacks,
}: KnacksDomainsPanelProps) {
    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div className={styles.eyebrow}>Proficiencies</div>
                <h2>Knacks & Domains</h2>
            </header>

            <div className={styles.layout}>
                <article className={styles.card}>
                    <h3>Knacks</h3>
                    <div className={styles.knackList}>
                        {knacks.map((knack) => (
                            <div key={knack.id} className={styles.knackItem}>
                                <strong>{knack.name}</strong>
                                {knack.summary ? <p>{knack.summary}</p> : null}
                                {knack.linkedSkills?.length ? (
                                    <span>{knack.linkedSkills.join(" · ")}</span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </article>

                <article className={styles.card}>
                    <h3>Domains</h3>
                    <div className={styles.domainList}>
                        {domains.map((domain) => (
                            <div key={domain.id} className={styles.domainChip}>
                                <strong>{domain.label}</strong>
                                {domain.deity ? <span>{domain.deity}</span> : null}
                                <p>{domain.summary}</p>
                            </div>
                        ))}
                    </div>
                </article>
            </div>
        </section>
    );
}