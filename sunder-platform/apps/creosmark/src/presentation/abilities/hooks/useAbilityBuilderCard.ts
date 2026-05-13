import { useEffect, useMemo, useState } from "react";
import type { AbilityBuilderNode } from "../../../domain";
import {
    createDefaultAbilityCardState,
    normalizeAbilityCardState,
    validateAbilityCard,
} from "../../../domain";

export function useAbilityBuilderCard(nodes: AbilityBuilderNode[]) {
    const [builderView, setBuilderView] = useState<"tree" | "card">("tree");
    const [cardState, setCardState] = useState(() => createDefaultAbilityCardState(nodes));

    useEffect(() => {
        setCardState((current) => normalizeAbilityCardState(nodes, current));
    }, [nodes]);

    const cardIssues = useMemo(
        () => validateAbilityCard(nodes, cardState),
        [nodes, cardState],
    );

    const hasBlockingCardIssues = useMemo(
        () => cardIssues.some((issue) => issue.severity === "blocking"),
        [cardIssues],
    );

    return {
        builderView,
        setBuilderView,
        cardState,
        setCardState,
        cardIssues,
        hasBlockingCardIssues,
    };
}