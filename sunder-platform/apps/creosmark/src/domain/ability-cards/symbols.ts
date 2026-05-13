export type CardSymbolDefinition = {
    className: string;
    html: string;
};

function createFontAwesomeSymbol(iconName: string): CardSymbolDefinition {
    const className = `fa-solid fa-${iconName}`;
    return {
        className,
        html: `<i class="${className}" aria-hidden="true"></i>`,
    };
}

function buildSymbolMap<T extends Record<string, string>>(icons: T): {
    [K in keyof T]: CardSymbolDefinition;
} {
    const entries = Object.entries(icons).map(([key, iconName]) => [
        key,
        createFontAwesomeSymbol(iconName),
    ]);

    return Object.fromEntries(entries) as { [K in keyof T]: CardSymbolDefinition };
}

export const CARD_SYMBOLS = buildSymbolMap({
    // Existing builder symbol ids
    direct: "hand-fist",
    indirect: "hand-back-fist",
    reset: "clock-rotate-left",
    duration: "clock",
    damage: "meteor",
    range: "location-crosshairs",
    targeting: "bullseye",
    condition_minor: "shield-halved",
    condition_major: "skull",
    primed: "circle-notch",
    amplified: "wand-sparkles",
    narrative: "comments",
    generic: "asterisk",

    // Target types
    target_ranged: "location-crosshairs",
    target_melee: "hand-fist",
    target_self: "location-arrow",
    target_aoe: "explosion",
    target_multi: "bullseye",

    // Reset conditions
    reset_spell: "wand-sparkles",
    reset_short_rest: "book-bookmark",
    reset_long_rest: "book",
    reset_once_per_turn: "stopwatch",
    reset_once_per_scene: "clock-rotate-left",
    reset_general: "clock-rotate-left",

    // Durations
    duration_1_round: "stopwatch",
    duration_1_scene: "clock-rotate-left",
    duration_1_hour: "clock",
    duration_until_long_rest: "book",
    duration_until_dispelled: "scroll",
    duration_concentration: "user-clock",
    duration_sequence_die_slot: "circle-notch",
    duration_sequence_die_experience: "certificate",

    // Damage/healing
    effect_heal: "heart",
    effect_damage: "meteor",

    // Conditions
    condition_bleeding: "fire-flame-simple",
    condition_blinded: "splotch",
    condition_cursed: "heart-crack",
    condition_dazed: "spiral",
    condition_distracted: "puzzle-piece",
    condition_fortified: "lock",
    condition_frenzied: "heart-pulse",
    condition_invisible: "ghost",
    condition_vulnerable: "skull",
    condition_petrified: "snowflake",
    condition_pinned: "thumbtack",
    condition_retaliate: "tooth",
    condition_slowed: "splotch",
    condition_spirited: "sun",
    condition_warded: "shield-halved",
    condition_afraid: "spider",
    condition_armed: "dagger",
    condition_armored: "shirt",
    condition_bound: "hands-bound",
    condition_charmed: "face-grin-hearts",
    condition_deafened: "water",
    condition_empowered: "hand-holding-heart",
    condition_enraptured: "eye",
    condition_held: "handshake-angle",
    condition_muddled: "cloud",
    condition_pushed: "wind",
    condition_rooted: "anchor",
    condition_silenced: "face-meh-blank",
    condition_unseen: "eye-slash",
    condition_exhaustion: "moon",

    // Caveats/resources
    caveat_spend_resistance: "circle-xmark",
    caveat_take_stress: "bolt-lightning",

    // Roll modifiers
    roll_advantage: "star",
    roll_disadvantage: "star-half-stroke",

    // Dice symbols
    die_d4: "play",
    die_d6: "dice-d6",
    die_d8: "diamond",
    die_d10: "circle-half-stroke",
    die_d12: "hexagon",
    die_d20: "dice-d20",

    // Potentials and misc
    potential_might: "chess-knight",
    potential_finesse: "fingerprint",
    potential_nerve: "brain",
    potential_seep: "radiation",
    potential_instinct: "seedling",
    potential_wit: "magnifying-glass",
    potential_heart: "comments",
    potential_tether: "ring",
    token_spirit: "crow",
    token_flavor: "feather-pointed",
    token_experience: "certificate",
    action_expend: "ban",
    reference: "asterisk",
    effect_movement: "shoe-prints",
});

export type CardSymbolId = keyof typeof CARD_SYMBOLS;

export const CARD_SYMBOL_HTML: Record<CardSymbolId, string> = Object.fromEntries(
    Object.entries(CARD_SYMBOLS).map(([key, value]) => [key, value.html]),
) as Record<CardSymbolId, string>;

export const CARD_SYMBOL_CLASSNAMES: Record<CardSymbolId, string> = Object.fromEntries(
    Object.entries(CARD_SYMBOLS).map(([key, value]) => [key, value.className]),
) as Record<CardSymbolId, string>;

export function getCardSymbol(symbolId: string): CardSymbolDefinition {
    return CARD_SYMBOLS[symbolId as CardSymbolId] ?? CARD_SYMBOLS.generic;
}

export function getCardSymbolHtml(symbolId: string): string {
    return getCardSymbol(symbolId).html;
}

export function getCardSymbolClassName(symbolId: string): string {
    return getCardSymbol(symbolId).className;
}
