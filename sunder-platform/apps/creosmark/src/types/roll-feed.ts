export type RollBroadcastMode = "self" | "gm" | "everyone";

export type CampaignAssignment = {
    id: string;
    name: string;
    role?: "gm" | "player";
};

export type RollFeedItem = {
    id: string;
    campaignId: string;
    characterSheetId: string;
    authorUserId: string;
    characterName: string;
    skillTestLabel: string;
    visibility: "gm" | "everyone";
    baseD20: number;
    volatilityResults: number[];
    finalSuccessLevel: string;
    createdAt: string;
    rollJson: unknown;
};