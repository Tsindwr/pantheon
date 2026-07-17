import React from "react";
import AuthStatus from "../auth/AuthStatus";
import NavBar from "../common/NavBar.tsx";
import styles from "./AppShell.module.css";
import { routes } from "../../lib/routing.ts";

type AppShellProps = {
    children: React.ReactNode;
    aside?: React.ReactNode;
    activePath?: string;
    bodyClassName?: string;
    mainClassName?: string;
};

export default function AppShell({
    children,
    aside,
    activePath = routes.home(),
    bodyClassName,
    mainClassName,
}: AppShellProps) {
    const bodyClasses = [styles.body, bodyClassName].filter(Boolean).join(" ");
    const mainClasses = [styles.main, mainClassName].filter(Boolean).join(" ");

    return (
        <div className={`${styles.page}`}>
            <NavBar
                activePath={activePath}
                authSlot={<AuthStatus />}
            />

            <div className={bodyClasses}>
                <main className={mainClasses}>{children}</main>
                {aside ? <aside className={styles.aside}>{aside}</aside> : null}
            </div>
        </div>
    );
}
