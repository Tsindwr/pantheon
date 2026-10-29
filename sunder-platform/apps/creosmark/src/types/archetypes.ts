export type ArchetypeId =
    | "spellslinger"
    | "summoner"
    | "face"
    | "control"
    | "saboteur"
    | "support"
    | "frontliner"
    | "halfcaster"
    | "healer"
    | "tank";

export type ArchetypeData = {
    id: ArchetypeId;
    label: string;
    levels: number;
};