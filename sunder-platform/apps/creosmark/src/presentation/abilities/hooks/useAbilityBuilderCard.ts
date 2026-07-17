import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { AbilityBuilderNode, AbilityCardState } from "../../../domain";
import {
    createDefaultAbilityCardState,
    normalizeAbilityCardState,
    validateAbilityCard,
} from "../../../domain";

type AbilityBuilderCardOptions = {
    onBeforeChange?: () => void;
};

function resolveStateAction<T>(action: SetStateAction<T>, current: T): T {
    return typeof action === "function"
        ? (action as (value: T) => T)(current)
        : action;
}

export function useAbilityBuilderCard(
    nodes: AbilityBuilderNode[],
    options: AbilityBuilderCardOptions = {},
) {
    const { onBeforeChange } = options;
    const [builderView, setBuilderView] = useState<"tree" | "card">("tree");
    const [cardState, setCardStateInternal] = useState(() => createDefaultAbilityCardState(nodes));
    const cardStateRef = useRef(cardState);

    useEffect(() => {
        cardStateRef.current = cardState;
    }, [cardState]);

    const setCardState = useCallback((action: SetStateAction<AbilityCardState>) => {
        const current = cardStateRef.current;
        const next = resolveStateAction(action, current);
        if (Object.is(next, current)) return;

        onBeforeChange?.();
        cardStateRef.current = next;
        setCardStateInternal(next);
    }, [onBeforeChange]);

    const restoreCardState = useCallback((next: AbilityCardState) => {
        cardStateRef.current = next;
        setCardStateInternal(next);
    }, []);

    useEffect(() => {
        setCardStateInternal((current) => {
            const next = normalizeAbilityCardState(nodes, current);
            cardStateRef.current = next;
            return next;
        });
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
        restoreCardState,
        cardIssues,
        hasBlockingCardIssues,
    };
}
