import React from "react";
import styles from "./NavBar.module.css";
import { routes } from "../../lib/routing.ts";

type NavLink = {
    label: string;
    href: string;
    /** Emoji / single-glyph icon shown before the label */
    icon?: string;
    /** If true the link is rendered but not interactive (WIP) */
    disabled?: boolean;
};

const NAV_LINKS: NavLink[] = [
    {label: "Characters", href: routes.home(), icon: "🧙"},
    {label: "Campaigns", href: routes.campaignHome(), icon: "⚔️"},
    {label: "Abilities", href: routes.abilitiesHome(), icon: "✨"},
];

type NavBarProps = {
    /** The current page path – used to highlight the active link */
    activePath?: string;
    /** Optional auth widget rendered on the far right */
    authSlot?: React.ReactNode;
    showBackButton?: boolean;
    backHref?: string;
};

/**
 * Universal top navigation bar.
 * Include in any page that needs site-wide navigation.
 */
export default function NavBar({
   activePath = routes.home(),
   authSlot,
   showBackButton = true,
    backHref = routes.home(),
}: NavBarProps) {
    function normalizePath(path: string): string {
        return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    }

    function handleBack() {
        if (typeof window === 'undefined') return;

        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        window.location.assign(routes.appHref(backHref));
    }

    return (
        <nav className={styles.nav} aria-label="Site navigation">
            <div className={styles.leftCluster}>
                {showBackButton ? (
                    <button
                        type={'button'}
                        className={styles.backButton}
                        onClick={handleBack}
                        aria-label={'Go back'}
                        >
                        <span className={styles.backIcon} aria-hidden={'true'}>←</span>
                        <span>Back</span>
                    </button>
                ) : null}

                <a href={routes.home()} className={styles.brand} aria-label="Creosmark home">
                    <span className={styles.brandName}>CREOSMARK</span>
                </a>
            </div>


            <div className={styles.links}>
                {NAV_LINKS.map((link) => {
                    const isActive = normalizePath(activePath) === normalizePath(link.href);
                    const cls = [
                        styles.link,
                        isActive ? styles.active : "",
                        link.disabled ? styles.disabled : "",
                    ]
                        .filter(Boolean)
                        .join(" ");

                    return link.disabled ? (
                        <span
                            key={link.href}
                            className={cls}
                            aria-disabled="true"
                            title="Coming soon"
                        >
                            {link.icon ? (
                                <span className={styles.icon} aria-hidden="true">
                                    {link.icon}
                                </span>
                            ) : null}
                            {link.label}
                            <span className={styles.wip}>WIP</span>
                        </span>
                    ) : (
                        <a
                            key={link.href}
                            href={link.href}
                            className={cls}
                            aria-current={isActive ? "page" : undefined}
                        >
                            {link.icon ? (
                                <span className={styles.icon} aria-hidden="true">
                                    {link.icon}
                                </span>
                            ) : null}
                            {link.label}
                        </a>
                    );
                })}
            </div>

            {authSlot ? <div className={styles.auth}>{authSlot}</div> : null}
        </nav>
    );
}
