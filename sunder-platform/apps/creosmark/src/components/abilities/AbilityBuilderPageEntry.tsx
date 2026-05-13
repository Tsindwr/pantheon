import React from 'react';
import AppShell from "../app/AppShell.tsx";
import AbilityBuilderShell from "./AbilityBuilderShell.tsx";
import { routes } from "../../lib/routing.ts";

export default function AbilityBuilderPageEntry() {
    return (
        <AppShell activePath={routes.abilitiesHome()}>
            <AbilityBuilderShell />
        </AppShell>
    );
}
