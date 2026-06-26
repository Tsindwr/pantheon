import React from 'react';
import AppShell from '../app/AppShell';
import AuthGate from '../auth/AuthGate';
import SignInScreen from '../auth/SignInScreen';
import CampaignRosterFromDb from "./CampaignRosterFromDb.tsx";
import styles from "./CampaignRosterPage.module.css";
import { routes } from "../../lib/routing.ts";
import { useQueryParam} from "../../lib/useQueryParams.ts";

function InnerCampaignQueryPageEntry() {
    const { value: campaignId, ready } = useQueryParam('id');

    if (!ready) {
        return <div className={styles.state}>Loading campaign...</div>
    }

    if (!campaignId) {
        return <div className={styles.state}>Missing campaign id.</div>
    }

    return <CampaignRosterFromDb campaignId={campaignId} />
}

export default function CampaignQueryPageEntry() {
    return (
        <AppShell activePath={routes.campaignHome()}>
            <AuthGate fallback={<SignInScreen />}>
                <InnerCampaignQueryPageEntry />
            </AuthGate>
        </AppShell>
    )
}
