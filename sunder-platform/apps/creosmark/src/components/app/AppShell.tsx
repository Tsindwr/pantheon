import React from "react";
import AuthStatus from "../auth/AuthStatus";
import NavBar from "../common/NavBar.tsx";
import styles from "./AppShell.module.css";
import { routes } from "../../lib/routing.ts";

type AppShellProps = {
    children: React.ReactNode;
    aside?: React.ReactNode;
    activePath?: string;
};

export default function AppShell({
    children,
    aside,
    activePath = routes.home(),
}: AppShellProps) {
    return (
        <div className={`${styles.page}`}>
            <NavBar
                activePath={activePath}
                authSlot={<AuthStatus />}
            />

            <div className={styles.body}>
                <main className={styles.main}>{children}</main>
                {aside ? <aside className={styles.aside}>{aside}</aside> : null}
            </div>
        </div>
    );
}
