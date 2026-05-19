import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    type AbilityCardFaceState,
    type AbilityCardState,
    type AbilityPublishDocument,
} from "../../domain";
import {
    listAbilityPlayCardsByIds,
    type AbilityPlayCard,
} from "../../infrastructure";
import AbilityCardFrame from "../../presentation/abilities/cards/AbilityCardFrame.tsx";
import AbilityCardModuleRenderer from "../../presentation/abilities/cards/AbilityCardModuleRenderer.tsx";
import styles from "./CharacterAbilitiesPanel.module.css";

type CharacterAbilitiesPanelProps = {
    abilityIds: string[];
};

type PlaymatCardKind = "action" | "surge" | "trait";

type PlaymatCard = {
    id: string;
    title: string;
    subtitle: string;
    kind: PlaymatCardKind;
    source: "custom" | "default";
    document: AbilityPublishDocument;
};

type CardSpotlightState = {
    card: PlaymatCard;
    faceIndex: number;
    originRect: DOMRectInit | null;
    isClosing: boolean;
}

type HandFanProps = {
    title: string;
    cards: PlaymatCard[];
    side: "left" | "right";
    previewFaceIndexByCardId: Record<string, number>;
    flippingCardIds: Record<string, boolean>;
    onCardSelect: (card: PlaymatCard, originElement?: HTMLElement) => void;
    onCardFaceToggle: (event: React.MouseEvent<HTMLElement>, card: PlaymatCard) => void;
};

const NOOP_CARD_STATE_CHANGE = () => {};

const DEFAULT_ACTION_DEFINITIONS = [
    {
        id: "default-strike",
        title: "Strike",
        attackText:
            "Equip and use a tool or weapon to make a Test melee attack against a target. Range - Here.",
        movementText:
            "Until the start of your next turn, reduce incoming Might Stress by your Might Volatility Die while armed. If unarmed, spend 1 Might Resistance to gain this benefit.",
    },
    {
        id: "default-shift",
        title: "Shift",
        attackText: "Move up to Close. This movement may pass through hostile spaces.",
        movementText: "Retrieve, stow, or swap objects within Here.",
    },
    {
        id: "default-endure",
        title: "Endure",
        attackText:
            "Once before the beginning of your next turn, you may expend a Nerve Resistance to succeed on a Test.",
        movementText: "Make a Grit or Frame Test to remove 1 Physical Stress.",
    },
    {
        id: "default-adapt",
        title: "Adapt",
        attackText:
            "Spend a Stress in Seep to repeat a Test to resist an active Condition.",
        movementText:
            "Give a Near creature Advantage on a Test regarding a specified course of action.",
    },
    {
        id: "default-evade",
        title: "Evade",
        attackText:
            "Until the start of your next turn, Tests made against you targeting Physical Potentials have Disadvantage.",
        movementText:
            "Attempt to break line of sight or avoid attention. Test Sleight or Aura: on success, you are Unseen to creatures relying on sight.",
    },
    {
        id: "default-manipulate",
        title: "Manipulate",
        attackText: "Make a Risky interaction with a mundane object or mechanism.",
        movementText: "Search a creature or container with a Sense Test.",
    },
    {
        id: "default-influence",
        title: "Influence",
        attackText:
            "Make a Sway Test to influence a creature's disposition. On success, the target gains Charmed and you gain a Beat.",
        movementText:
            "Make a Hope or Anchor Test to remove 1 Mental Stress from yourself or an ally within Here.",
    },
    {
        id: "default-spin",
        title: "Spin",
        attackText:
            "Make a Weave or Esoterica Test to interact with an active Dwoemer or Binding.",
        movementText:
            "Until the start of your next turn, you have Advantage on Tests made to resist Magick effects targeting Mental Potentials.",
    },
    {
        id: "default-narrate",
        title: "Narrate",
        attackText:
            "Play when making a Group Action with allies on the same turn. This counts as adding 1 person to the Group Action.",
        movementText: "Spend Flavor Tokens to activate a Flavor Ability.",
    },
] as const;

function createDefaultActionCardDocument(definition: {
    id: string;
    title: string;
    attackText: string;
    movementText: string;
}): AbilityPublishDocument {
    const directFaceId = `${definition.id}-direct`;
    const indirectFaceId = `${definition.id}-indirect`;

    const cardState: AbilityCardState = {
        version: 2,
        format: "action",
        titleOverride: "",
        subtitleOverride: "General Action",
        ignoredModifierNodeIds: [],
        faces: [
            {
                id: directFaceId,
                faceKind: "direct",
                modules: [
                    {
                        id: `${directFaceId}-rules`,
                        type: "rules_text",
                        runs: [{ id: `${directFaceId}-text`, kind: "text", text: definition.attackText }],
                    },
                ],
            },
            {
                id: indirectFaceId,
                faceKind: "indirect",
                modules: [
                    {
                        id: `${indirectFaceId}-rules`,
                        type: "rules_text",
                        runs: [{ id: `${indirectFaceId}-text`, kind: "text", text: definition.movementText }],
                    },
                ],
            },
        ],
    };

    return {
        version: 2,
        abilityId: definition.id,
        title: definition.title,
        abilityKind: "action",
        activationProfile: {
            actionEconomyId: "action",
            resetConditionId: "general",
        },
        graph: {
            nodes: [],
            edges: [],
        },
        card: cardState,
        computed: {
            total: { strings: 0, beats: 0, enhancements: 0 },
            paid: { strings: 0, beats: 0, enhancements: 0 },
            focus: { strings: 0, beats: 0, enhancements: 0 },
            flipside: { strings: 0, beats: 0, enhancements: 0 },
            body: { strings: 0, beats: 0, enhancements: 0 },
            isAction: true,
            flipsideBudgetStrings: 0,
            flipsideBudgetEnhancements: 0,
            warnings: [],
            notes: [],
        },
    };
}

function classifyAbilityKind(document: AbilityPublishDocument): PlaymatCardKind {
    const economy = document.activationProfile.actionEconomyId;
    if (economy === "trait") return "trait";
    if (economy === "surge") return "surge";
    return document.abilityKind === "trait"
        ? "trait"
        : document.abilityKind === "surge"
            ? "surge"
            : "action";
}

function resolveCardSubtitle(card: AbilityPlayCard, kind: PlaymatCardKind): string {
    if (kind === "trait") return "Trait";
    if (kind === "surge") return "Surge";
    return card.abilityKind === "spell" ? "Spell Action" : "Custom Action";
}

function faceLabel(faceKind: AbilityCardFaceState["faceKind"]): string {
    if (faceKind === "direct") return "Attack";
    if (faceKind === "indirect") return "Movement";
    return "Card";
}

function preferredFaceIndex(card: PlaymatCard): number {
    if (card.kind !== "action") return 0;
    const directIndex = card.document.card.faces.findIndex((face) => face.faceKind === "direct");
    return directIndex >= 0 ? directIndex : 0;
}

function resolveNextFaceIndex(
    card: PlaymatCard,
    currentFaceIndex: number,
): number {
    const faces = card.document.card.faces;
    if (faces.length <= 1) return currentFaceIndex;

    const directIndex = faces.findIndex((face) => face.faceKind === "direct");
    const indirectIndex = faces.findIndex((face) => face.faceKind === "indirect");

    if (directIndex >= 0 && indirectIndex >= 0) {
        if (currentFaceIndex === directIndex) return indirectIndex;
        if (currentFaceIndex === indirectIndex) return directIndex;
    }

    return (currentFaceIndex + 1) % faces.length;
}

function resolveResetLabel(document: AbilityPublishDocument): string {
    switch (document.activationProfile.resetConditionId) {
        case "general":
            return "General";
        case "spell":
            return "Spell";
        case "shortRest":
            return "Short Rest";
        case "longRest":
            return "Long Rest";
        case "conditional":
            return "Conditional";
        default:
            return "General";
    }
}

function resolveContentDensity(
    card: PlaymatCard,
    face: AbilityCardFaceState,
): "roomy" | "normal" | "compact" {
    let textChars = 0;
    let modifierRuns = 0;
    let railItems = 0;

    for (const module of face.modules) {
        if (module.type === "icon_rail") {
            railItems += module.items.length;
            continue;
        }

        if ("text" in module && typeof module.text === "string") {
            textChars += module.text.trim().length;
        }

        if ("runs" in module && Array.isArray(module.runs)) {
            for (const run of module.runs) {
                if (run.kind === "text") {
                    textChars += run.text.trim().length;
                } else {
                    modifierRuns += 1;
                }
            }
        }
    }

    const sectionCount = face.modules.length;
    const complexityScore =
        textChars +
        (modifierRuns * 22) +
        (railItems * 28) +
        (sectionCount * 44);

    if (complexityScore >= 250) return "compact";
    if (complexityScore <= 140) return "roomy";
    return "normal";
}

function buildCardSpotlightStyle(
    spotlight: CardSpotlightState,
): React.CSSProperties {
    if (typeof window === 'undefined') {
        return {};
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let targetHeightPx = Math.min(
        viewportWidth * 0.78,
        viewportHeight - 48,
    );

    let targetWidthPx = targetHeightPx * 63 / 88;

    // Safety for narrow screens.
    const maxWidthPx = viewportWidth - 48;
    if (targetWidthPx > maxWidthPx) {
        targetWidthPx = maxWidthPx;
        targetHeightPx = targetWidthPx * 88 / 63;
    }

    const origin = spotlight.originRect;

    const originCenterX = origin
        ? (origin.x ?? 0) + (origin.width ?? 0) / 2
        : viewportWidth / 2;

    const originCenterY = origin
        ? (origin.y ?? 0) + (origin.height ?? 0) / 2
        : viewportHeight / 2;

    const fromX = originCenterX - viewportWidth / 2;
    const fromY = originCenterY - viewportHeight / 2;

    const fromScale = origin?.height
        ? Math.max(0.2, Math.min(1.1, origin.height / targetHeightPx))
        : 0.45;

    return {
        "--spotlight-card-width": `${targetWidthPx.toFixed(2)}px`,
        "--spotlight-card-height": `${targetHeightPx.toFixed(2)}px`,
        "--spotlight-from-x": `${fromX.toFixed(2)}px`,
        "--spotlight-from-y": `${fromY.toFixed(2)}px`,
        "--spotlight-from-scale": `${fromScale.toFixed(3)}`,
    } as React.CSSProperties;
}

function CardPreview(props: {
    card: PlaymatCard;
    faceIndex?: number;
    className?: string;
    isFlipping?: boolean;
    onFaceBadgeClick?: React.MouseEventHandler<HTMLElement>;
    displayMode?: "tray" | "full";
}) {
    const {
        card,
        faceIndex = preferredFaceIndex(card),
        className,
        isFlipping = false,
        onFaceBadgeClick,
        displayMode = 'tray',
    } = props;

    const faces = card.document.card.faces;
    const face = faces[faceIndex] ?? faces[0];
    if (!face) return null;

    const density = resolveContentDensity(card, face);

    const cardFrame = (
        <AbilityCardFrame
            format={card.document.card.format}
            faceKind={face.faceKind}
            title={card.title}
            subtitle={card.subtitle}
            resetLabel={resolveResetLabel(card.document)}
            preview="preview"
            onFaceBadgeClick={onFaceBadgeClick}
            contentDensity={density}
        >
            <AbilityCardModuleRenderer
                nodes={card.document.graph.nodes}
                cardState={card.document.card}
                faceId={face.id}
                previewMode="preview"
                onCardStateChange={NOOP_CARD_STATE_CHANGE}
            />
        </AbilityCardFrame>
    );

    if (displayMode === "full") {
        return (
            <div className={`${className ?? ""} ${isFlipping ? styles.previewFlip : ""}`.trim()}>
                {cardFrame}
            </div>
        );
    }

    return (
        <div className={`${className ?? ""} ${styles.scaledCardSlot}`.trim()}>
            <div className={styles.scaledCardInner}>
                <div className={isFlipping ? styles.previewFlip : undefined}>
                    {cardFrame}
                </div>
            </div>
        </div>
    );
}

function HandFan({
    title,
    cards,
    side,
    previewFaceIndexByCardId,
    flippingCardIds,
    onCardSelect,
    onCardFaceToggle,
}: HandFanProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const railRef = useRef<HTMLDivElement | null>(null);
    const [cardStepPx, setCardStepPx] = useState(90);

    useLayoutEffect(() => {
        const rail = railRef.current;
        if (!rail) return;

        const resolveCssLengthToPx = (rawValue: string): number => {
            const trimmed = rawValue.trim();
            if (!trimmed) return 0;

            if (trimmed.endsWith("px")) return Number.parseFloat(trimmed) || 0;

            if (trimmed.endsWith("rem")) {
                const rootSize = Number.parseFloat(
                    window.getComputedStyle(document.documentElement).fontSize,
                );
                return (Number.parseFloat(trimmed) || 0) * (rootSize || 16);
            }
            return Number.parseFloat(trimmed) || 0;
        };

        const updateCardStep = () => {
            const railRect = rail.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(rail);

            const paddingLeftPx = Number.parseFloat(computedStyle.paddingLeft) || 0;
            const paddingRightPx = Number.parseFloat(computedStyle.paddingRight) || 0;

            const railWidthPx = Math.max(
                0,
                railRect.width - paddingLeftPx - paddingRightPx,
            );

            const firstCardEl = rail.querySelector(
                "[data-hand-card='true']",
            ) as HTMLButtonElement | null;

            const measuredCardWidthPx = firstCardEl?.getBoundingClientRect().width ?? 0;

            const cardWidthRaw = computedStyle.getPropertyValue("--hand-card-width");
            const cardWidthPxFromVar = resolveCssLengthToPx(cardWidthRaw);

            // Prefer measured width because transformed/slot-based previews may not match the raw CSS var.
            const cardWidthPx =
                measuredCardWidthPx > 0 ? measuredCardWidthPx : cardWidthPxFromVar;

            if (cards.length <= 1) {
                setCardStepPx(cardWidthPx > 0 ? cardWidthPx : 160);
                return;
            }

            if (cardWidthPx <= 0 || railWidthPx <= 0) {
                setCardStepPx(90);
                return;
            }

            const edgeGutterPx = 12;

            // This is the step required for:
            // left edge of first card visible +
            // right edge of last card visible.
            const fitStep =
                (railWidthPx - cardWidthPx - edgeGutterPx) / (cards.length - 1);

            // Prevent silly over-spreading on very wide monitors.
            const maxComfortableStep = cardWidthPx * 0.72;

            const resolvedStep = Math.max(
                0,
                Math.min(maxComfortableStep, fitStep),
            );

            setCardStepPx(Number(resolvedStep.toFixed(2)));
        };

        updateCardStep();

        const observer = new ResizeObserver(updateCardStep);
        observer.observe(rail);

        return () => observer.disconnect();
    }, [cards.length]);

    return (
        <section className={`${styles.handZone} ${side === "right" ? styles.handZoneRight : styles.handZoneLeft}`}>
            <header className={styles.handHeader}>
                <span>{title}</span>
                <small>{cards.length}</small>
            </header>

            <div
                ref={railRef}
                className={styles.handRail}
                style={{ "--hand-step": `${cardStepPx.toFixed(2)}px` } as React.CSSProperties}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                {cards.map((card, index) => {
                    const distance = hoveredIndex === null ? null : Math.abs(index - hoveredIndex);
                    const baselineY = 172;
                    const raisePx = distance === null ? 0 : Math.max(0, 175 - distance * 60);
                    const translateY = baselineY - raisePx;
                    const zIndex = distance === null
                        ? 160 + index
                        : distance === 0
                            ? 600
                            : 260 - distance;
                    const faceIndex = previewFaceIndexByCardId[card.id] ?? preferredFaceIndex(card);

                    return (
                        <button
                            key={card.id}
                            type="button"
                            data-hand-card="true"
                            className={styles.handCardButton}
                            onClick={(event) => onCardSelect(card, event.currentTarget)}
                            style={
                                {
                                    "--hand-y": `${translateY.toFixed(2)}px`,
                                    "--hand-z": `${zIndex}`,
                                } as React.CSSProperties
                            }
                            title={card.title}
                            onMouseEnter={() => setHoveredIndex(index)}
                        >
                            <CardPreview
                                card={card}
                                faceIndex={faceIndex}
                                className={styles.handCardPreview}
                                isFlipping={Boolean(flippingCardIds[card.id])}
                                onFaceBadgeClick={(event) => onCardFaceToggle(event, card)}
                            />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default function CharacterAbilitiesPanel({
    abilityIds,
}: CharacterAbilitiesPanelProps) {
    const [cards, setCards] = useState<PlaymatCard[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const [previewFaceIndexByCardId, setPreviewFaceIndexByCardId] = useState<Record<string, number>>({});
    const [flippingCardIds, setFlippingCardIds] = useState<Record<string, boolean>>({});

    const [spotlight, setSpotlight] = useState<CardSpotlightState | null>(null);
    const spotlightCloseTimerRef = useRef<number | null>(null);

    const flipTimerByCardIdRef = useRef<Record<string, number>>({});

    const closeSpotlight = useCallback(() => {
        setSpotlight((current) => {
            if (!current || current.isClosing) return current;
            return { ...current, isClosing: true };
        });

        if (spotlightCloseTimerRef.current) {
            window.clearTimeout(spotlightCloseTimerRef.current);
        }

        spotlightCloseTimerRef.current = window.setTimeout(() => {
            setSpotlight(null);
            spotlightCloseTimerRef.current = null;
        }, 190);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadCards() {
            try {
                setLoading(true);
                setErrorText(null);

                const playCards = await listAbilityPlayCardsByIds(abilityIds);
                if (cancelled) return;

                setCards(
                    playCards.map((card) => {
                        const kind = classifyAbilityKind(card.abilityDocument);
                        return {
                            id: card.id,
                            title: card.title,
                            subtitle: resolveCardSubtitle(card, kind),
                            kind,
                            source: "custom",
                            document: card.abilityDocument,
                        } satisfies PlaymatCard;
                    }),
                );
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error ? error.message : "Failed to load ability cards.",
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadCards();

        return () => {
            cancelled = true;
        };
    }, [abilityIds]);

    useEffect(() => {
        if (!spotlight) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            closeSpotlight();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [spotlight, closeSpotlight]);

    useEffect(() => {
        return () => {
            for (const timerId of Object.values(flipTimerByCardIdRef.current)) {
                window.clearTimeout(timerId);
            }

            if (spotlightCloseTimerRef.current) {
                window.clearTimeout(spotlightCloseTimerRef.current);
            }
        };
    }, []);

    const resolvePreviewFaceIndex = (card: PlaymatCard): number => {
        const configured = previewFaceIndexByCardId[card.id];
        if (configured === undefined) return preferredFaceIndex(card);

        const maxIndex = card.document.card.faces.length - 1;
        if (maxIndex < 0) return 0;
        return Math.max(0, Math.min(configured, maxIndex));
    };

    const openSpotlightFromCard = (
        card: PlaymatCard,
        originElement?: HTMLElement,
    ) => {
        const rect = originElement?.getBoundingClientRect();

        setSpotlight({
            card,
            faceIndex: resolvePreviewFaceIndex(card),
            originRect: rect
                ? {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                }
                : null,
            isClosing: false,
        });
    };

    const toggleSpotlightFace = (
        event: React.MouseEvent<HTMLElement>,
        card: PlaymatCard,
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const currentFaceIndex =
            spotlight?.card.id === card.id
                ? spotlight.faceIndex
                : resolvePreviewFaceIndex(card);

        const nextFaceIndex = resolveNextFaceIndex(card, currentFaceIndex);
        if (nextFaceIndex === currentFaceIndex) return;

        setSpotlight((current) => {
            if (!current || current.card.id !== card.id) return current;
            return {
                ...current,
                faceIndex: nextFaceIndex,
            };
        });

        setPreviewFaceIndexByCardId((current) => ({
            ...current,
            [card.id]: nextFaceIndex,
        }));
    };

    const toggleCardFace = (
        event: React.MouseEvent<HTMLElement>,
        card: PlaymatCard,
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const currentFaceIndex = resolvePreviewFaceIndex(card);
        const nextFaceIndex = resolveNextFaceIndex(card, currentFaceIndex);
        if (nextFaceIndex === currentFaceIndex) return;

        setPreviewFaceIndexByCardId((current) => ({
            ...current,
            [card.id]: nextFaceIndex,
        }));

        setFlippingCardIds((current) => ({
            ...current,
            [card.id]: true,
        }));

        const existingTimer = flipTimerByCardIdRef.current[card.id];
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        flipTimerByCardIdRef.current[card.id] = window.setTimeout(() => {
            setFlippingCardIds((current) => {
                if (!current[card.id]) return current;
                const next = { ...current };
                delete next[card.id];
                return next;
            });

            delete flipTimerByCardIdRef.current[card.id];
        }, 230);
    };

    const defaultActionCards = useMemo<PlaymatCard[]>(
        () =>
            DEFAULT_ACTION_DEFINITIONS.map((definition) => ({
                id: definition.id,
                title: definition.title,
                subtitle: "Default Action",
                kind: "action",
                source: "default",
                document: createDefaultActionCardDocument(definition),
            })),
        [],
    );

    const traitCards = useMemo(
        () => cards.filter((card) => card.kind === "trait"),
        [cards],
    );
    const surgeCards = useMemo(
        () => cards.filter((card) => card.kind === "surge"),
        [cards],
    );
    const actionCards = useMemo(
        () => cards.filter((card) => card.kind === "action"),
        [cards],
    );

    const spotlightFace =
        spotlight?.card.document.card.faces[spotlight?.faceIndex] ??
        spotlight?.card.document.card.faces[0] ??
        null;

    return (
        <section className={styles.playmat}>
            <header className={styles.playmatHeader}>
                <div className={styles.playmatTitleGroup}>
                    <div className={styles.eyebrow}>Abilities</div>
                    <h3>Combat Playmat</h3>
                </div>

                <div className={styles.playmatMeta}>
                    <span>{`${actionCards.length} Custom Actions`}</span>
                    <span>{`${surgeCards.length} Surges`}</span>
                    <span>{`${traitCards.length} Traits`}</span>
                </div>
            </header>

            {errorText ? <div className={styles.state}>Error: {errorText}</div> : null}
            {loading ? <div className={styles.state}>Loading cards...</div> : null}

            <div className={styles.activeZone}>
                <section className={styles.traitsColumn}>
                    <div className={styles.zoneLabel}>Trait Cards</div>

                    {traitCards.length === 0 ? (
                        <div className={styles.emptyZone}>No Trait cards assigned.</div>
                    ) : (
                        <div className={styles.traitStack}>
                            {traitCards.map((card, index) => (
                                <button
                                    key={card.id}
                                    type="button"
                                    className={styles.traitStackItem}
                                    style={{ "--trait-index": `${index}` } as React.CSSProperties}
                                    onClick={(event) => openSpotlightFromCard(card, event.currentTarget)}
                                >
                                    <CardPreview
                                        card={card}
                                        faceIndex={resolvePreviewFaceIndex(card)}
                                        className={styles.traitPreview}
                                        isFlipping={Boolean(flippingCardIds[card.id])}
                                        onFaceBadgeClick={(event) => toggleCardFace(event, card)}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className={styles.surgeRow}>
                    <div className={styles.zoneLabel}>Surge Cards</div>

                    {surgeCards.length === 0 ? (
                        <div className={styles.emptyZone}>No Surge cards assigned.</div>
                    ) : (
                        <div className={styles.surgeCards}>
                            {surgeCards.map((card) => (
                                <button
                                    key={card.id}
                                    type="button"
                                    className={styles.surgeCardButton}
                                    onClick={(event) => openSpotlightFromCard(card, event.currentTarget)}
                                >
                                    <CardPreview
                                        card={card}
                                        faceIndex={resolvePreviewFaceIndex(card)}
                                        className={styles.surgePreview}
                                        isFlipping={Boolean(flippingCardIds[card.id])}
                                        onFaceBadgeClick={(event) => toggleCardFace(event, card)}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className={styles.handDock}>
                <HandFan
                    title="Custom Action Hand"
                    cards={actionCards}
                    side="left"
                    previewFaceIndexByCardId={previewFaceIndexByCardId}
                    flippingCardIds={flippingCardIds}
                    onCardSelect={openSpotlightFromCard}
                    onCardFaceToggle={toggleCardFace}
                />

                <HandFan
                    title="Default Action Hand"
                    cards={defaultActionCards}
                    side="right"
                    previewFaceIndexByCardId={previewFaceIndexByCardId}
                    flippingCardIds={flippingCardIds}
                    onCardSelect={openSpotlightFromCard}
                    onCardFaceToggle={toggleCardFace}
                />
            </div>

            {spotlight ? (
                <div
                    className={`${styles.spotlight} ${
                        spotlight.isClosing ? styles.spotlightClosing : ""
                    }`}
                >
                    <button
                        type="button"
                        className={styles.spotlightScrim}
                        aria-label="Close card preview"
                        onClick={closeSpotlight}
                    />

                    <button
                        type="button"
                        className={styles.spotlightClose}
                        aria-label="Close card preview"
                        onClick={closeSpotlight}
                    >
                        ×
                    </button>

                    <div
                        className={styles.spotlightCardWrap}
                        style={buildCardSpotlightStyle(spotlight)}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {spotlightFace ? (
                            <CardPreview
                                card={spotlight.card}
                                faceIndex={spotlight.faceIndex}
                                className={styles.spotlightCardPreview}
                                displayMode={"full"}
                                onFaceBadgeClick={(event) =>
                                    toggleSpotlightFace(event, spotlight.card)
                                }
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
