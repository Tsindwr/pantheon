import React from 'react';
import AppShell from '../app/AppShell';
import AuthGate from "../auth/AuthGate.tsx";
import SignInScreen from "../auth/SignInScreen.tsx";
import CampaignsLibraryFromDb from './CampaignsLibraryFromDb';
import AtomicCampaignsLibraryFromDb from "./AtomicCampaignsLibraryFromDb.tsx";
import {
    canUseLocalAtomicCampaignCreation,
} from "../../infrastructure/library/campaign-creation-local-rollout.ts";
import { routes } from "../../lib/routing.ts";

const localAtomicCreationEnabled =
    canUseLocalAtomicCampaignCreation({
        enabled: import.meta.env.PUBLIC_CREOSMARK_ATOMIC_CAMPAIGN_CREATION,
        development: import.meta.env.DEV,
        backendUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    });

if (import.meta.env.DEV) {
    const backendUrl = import.meta.env.PUBLIC_SUPABASE_URL;

    let backend: {
        hostname: string;
        port: string;
        protocol: string;
    } | null = null;

    try {
        if (backendUrl) {
            const parsed = new URL(backendUrl);
            backend = {
                hostname: parsed.hostname,
                port: parsed.port,
                protocol: parsed.protocol,
            };
        }
    } catch {
        // Invalid or missing backend URL.
    }

    console.info("[B27 Campaign Rollout]", {
        enabled: import.meta.env.PUBLIC_CREOSMARK_ATOMIC_CAMPAIGN_CREATION,
        development: import.meta.env.DEV,
        backend,
        allowed: localAtomicCreationEnabled,
    });
}

export default function CampaignsHomeEntry() {
    return (
        <AppShell activePath={routes.campaignHome()}>
            <AuthGate fallback={<SignInScreen />}>
                {localAtomicCreationEnabled ? (
                    <AtomicCampaignsLibraryFromDb />
                ) : (
                    <CampaignsLibraryFromDb />
                )}
            </AuthGate>
        </AppShell>
    );
}
