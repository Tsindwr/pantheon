import React from 'react';
import AuthGate from '../auth/AuthGate';
import SignInScreen from '../auth/SignInScreen';
import CampaignRosterFromDb from "./CampaignRosterFromDb.tsx";
import { useQueryParam} from "../../lib/useQueryParams.ts";

function InnerCampaignQueryPageEntry() {
    const { value: campaignId, ready } = useQueryParam('id');

    if (!ready) {
        return <main style={{ padding: '1.5rem' }}>Loading...</main>
    }

    if (!campaignId) {
        return <main style={{ padding: '1.5rem' }}>Missing campaign id.</main>
    }

    return <CampaignRosterFromDb campaignId={campaignId} />
}

export default function CampaignQueryPageEntry() {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <InnerCampaignQueryPageEntry />
        </AuthGate>
    )
}