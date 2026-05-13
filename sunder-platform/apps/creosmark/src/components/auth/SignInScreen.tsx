import React from "react";
import { signInWithDiscord } from "../../lib/auth";
import styles from "./SignInScreen.module.css";

export default function SignInScreen() {
    return (
        <section className={styles.layout}>
            <div className={styles.eyebrow}>Welcome</div>
            <h2>Bring your sheets, campaigns, and rolls together.</h2>
            <p>
                Sign in with Discord to access your character library, campaign rosters,
                and shared table tools.
            </p>

            <button
                type="button"
                className={styles.primary}
                onClick={() => void signInWithDiscord()}
            >
                Continue with Discord
            </button>

            <div className={styles.supportTitle}>What you get</div>
            <ul className={styles.list}>
                <li>Character sheets and editing</li>
                <li>Campaign rosters and shared rolls</li>
                <li>Realtime visibility for table play</li>
            </ul>
        </section>
    );
}