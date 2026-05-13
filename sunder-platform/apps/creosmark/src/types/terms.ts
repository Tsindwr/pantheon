export type MinorConditionId =
    | "afraid"
    | "armed"
    | "armored"
    | "bound"
    | "charmed"
    | "deafened"
    | "empowered"
    | "enraptured"
    | "held"
    | "muddled"
    | "pushed"
    | "rooted"
    | "silenced"
    | "unseen"
    | "vulnerable";

export const MINOR_CONDITIONS: Record<MinorConditionId, string> = {
    afraid: "Afraid",
    armed: "Armed",
    armored: "Armored",
    bound: "Bound",
    charmed: "Charmed",
    deafened: "Deafened",
    empowered: "Empowered",
    enraptured: "Enraptured",
    held: "Held",
    muddled: "Muddled",
    pushed: "Pushed",
    rooted: "Rooted",
    silenced: "Silenced",
    unseen: "Unseen",
    vulnerable: "Vulnerable",
};

export type MajorConditionId =
    | "bleeding"
    | "blinded"
    | "cursed"
    | "dazed"
    | "distracted"
    | "fortified"
    | "frenzied"
    | "invisible"
    | "mentally_vulnerable"
    | "petrified"
    | "pinned"
    | "retaliate"
    | "slowed"
    | "spirited"
    | "warded"
    | "physically_vulnerable";

export const MAJOR_CONDITIONS: Record<MajorConditionId, string> = {
    bleeding: "Bleeding",
    blinded: "Blinded",
    cursed: "Cursed",
    dazed: "Dazed",
    distracted: "Distracted",
    fortified: "Fortified",
    frenzied: "Frenzied",
    invisible: "Invisible",
    mentally_vulnerable: "Mentally Vulnerable",
    petrified: "Petrified",
    pinned: "Pinned",
    retaliate: "Retaliate",
    slowed: "Slowed",
    spirited: "Spirited",
    warded: "Warded",
    physically_vulnerable: "Physically Vulnerable",
};