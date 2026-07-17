import type { AbilityLane, CardSideRef } from "../../../domain";

export type LaneControlValue = "body" | "direct" | "indirect" | "option";

export type LaneControlOption = {
    value: LaneControlValue;
    label: string;
};

export function getCardSideForLane(
    lane: AbilityLane,
    focusSide: CardSideRef,
): LaneControlValue {
    if (lane === "option") return "option";
    if (lane === "body") return "body";
    if (lane === "focus") return focusSide;

    return focusSide === "direct" ? "indirect" : "direct";
}

export function getLaneForCardSide(
    value: LaneControlValue,
    focusSide: CardSideRef,
): AbilityLane {
    if (value === "body" || value === "option") return value;

    return value === focusSide ? "focus" : "flipside";
}

export function getLaneControlOptions(
    lane: AbilityLane,
    isSplitActionCard: boolean,
): LaneControlOption[] {
    if (lane === "option") {
        return [{ value: "option", label: "Option" }];
    }

    if (isSplitActionCard) {
        return [
            { value: "direct", label: "Direct" },
            { value: "indirect", label: "Indirect" },
        ];
    }

    return [];
}
