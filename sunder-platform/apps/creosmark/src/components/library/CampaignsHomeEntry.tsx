import React from 'react';
import AppShell from '../app/AppShell';
import AuthGate from "../auth/AuthGate.tsx";
import SignInScreen from "../auth/SignInScreen.tsx";
import CampaignsLibraryFromDb from './CampaignsLibraryFromDb';
import { routes } from "../../lib/routing.ts";

export default function CampaignsHomeEntry() {
    return (
        <AppShell activePath={routes.campaignHome()}>
            <AuthGate fallback={<SignInScreen />}>
                <CampaignsLibraryFromDb />
            </AuthGate>
        </AppShell>
    )
}
