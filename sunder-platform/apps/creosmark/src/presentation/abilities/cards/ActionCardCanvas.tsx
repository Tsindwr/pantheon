import React from "react";
import type { AbilityBuilderNode, AbilityCardState } from "../../../domain";
import AbilityCardCanvas from "./AbilityCardCanvas";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    title: string;
    subtitle?: string;
    onCardStateChange: (next: AbilityCardState) => void;
};

export default function ActionCardCanvas({
    nodes,
    cardState,
    title,
    subtitle,
    onCardStateChange,
}: Props) {
    return (
        <AbilityCardCanvas
            nodes={nodes}
            cardState={cardState}
            title={title}
            subtitle={subtitle}
            onCardStateChange={onCardStateChange}
        />
    );
}
