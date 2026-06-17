export const DOMAINS = [
    {
        id: "flow",
        label: "Flow",
        deity: "The Ebb",
        summary: "Places in flux, cycles, healing, water."
    },
    {
        id: "gleam",
        label: "Gleam",
        deity: "The Glint",
        summary: "Desire, money, temptation, fey"
    },
    {
        id: "scorch",
        label: "Scorch",
        deity: "The Hunger",
        summary: "Desolate, wasteland, fire"
    },
    {
        id: "glare",
        label: "Glare",
        deity: "The Light",
        summary: "Illusion, deception, truth, exposure"
    },
    {
        id: "spark",
        label: "Spark",
        deity: "The Breath",
        summary: "Places of art, inspiration, ideation"
    },
    {
        id: "root",
        label: "Root",
        deity: "The Shade",
        summary: "Earth, thriving nature, growth, development"
    },
    {
        id: "still",
        label: "Still",
        deity: "The Lurking",
        summary: "Hunting, fear, territory"
    },
    {
        id: "crossing",
        label: "Crossing",
        deity: "The Migrant",
        summary: "Liminal spaces, wind, travel, havens"
    },
    {
        id: "warp",
        label: "Warp",
        deity: "The Phantom",
        summary: "Mysticism, warped landscape, shadow"
    },
    {
        id: "tear",
        label: "Tear",
        deity: "The Urge",
        summary: "Scarred terrain, wrath, war"
    },
    {
        id: "thread",
        label: "Thread",
        deity: "The Weaver",
        summary: "Study, knowledge, arcana"
    },
    {
        id: "remnant",
        label: "Remnant",
        deity: "The Crownless",
        summary: "Ruins, abandoned locations, forgotten knowledge"
    },
    {
        id: "bastion",
        label: "Bastion",
        deity: "The Lord",
        summary: "Justice, law, court, ordinance"
    }
];
export function getDomainById(id) {
    return DOMAINS.find((entry) => entry.id === id);
}
//# sourceMappingURL=domains.js.map