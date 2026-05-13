import React from "react";
import AuthGate from "../auth/AuthGate";
import SignInScreen from "../auth/SignInScreen";
import CampaignRosterFromDb from "./CampaignRosterFromDb";

type CampaignRosterPageEntryProps = {
    campaignId: string;
};

export default function CampaignRosterPageEntry({
                                                    campaignId,
                                                }: CampaignRosterPageEntryProps) {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <CampaignRosterFromDb campaignId={campaignId} />
        </AuthGate>
    );
}