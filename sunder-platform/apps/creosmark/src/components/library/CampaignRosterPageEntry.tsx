import React from "react";
import AppShell from "../app/AppShell";
import AuthGate from "../auth/AuthGate";
import SignInScreen from "../auth/SignInScreen";
import { routes } from "../../lib/routing.ts";
import CampaignRosterFromDb from "./CampaignRosterFromDb";

type CampaignRosterPageEntryProps = {
    campaignId: string;
};

export default function CampaignRosterPageEntry({
                                                    campaignId,
}: CampaignRosterPageEntryProps) {
    return (
        <AppShell activePath={routes.campaignHome()}>
            <AuthGate fallback={<SignInScreen />}>
                <CampaignRosterFromDb campaignId={campaignId} />
            </AuthGate>
        </AppShell>
    );
}
