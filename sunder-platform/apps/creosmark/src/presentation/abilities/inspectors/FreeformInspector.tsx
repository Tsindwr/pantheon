import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type {
    CardSideRef,
    FreeformData,
    FreeformNodeType,
} from "../../../domain";
import {
    getCardSideForLane,
    getLaneControlOptions,
    getLaneForCardSide,
    type LaneControlValue,
} from "./laneControls";

type FreeformInspectorProps = {
    node: FreeformNodeType;
    isSplitActionCard: boolean;
    focusSide: CardSideRef;
    onChange: (updater: (data: FreeformData) => FreeformData) => void;
};

export default function FreeformInspector({
    node,
    isSplitActionCard,
    focusSide,
    onChange,
}: FreeformInspectorProps) {
    const laneControlOptions = getLaneControlOptions(node.data.lane, isSplitActionCard);
    const laneControlValue = getCardSideForLane(node.data.lane, focusSide);
    const laneControlDisabled = laneControlOptions.length === 1;

    return (
        <div className={styles.editorStack}>
            <label className={styles.field}>
                <span>Title</span>
                <input
                    value={node.data.title}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            title: event.target.value,
                        }))
                    }
                />
            </label>

            {laneControlOptions.length > 0 ? (
                <label className={styles.field}>
                    <span>Lane</span>
                    <select
                        value={laneControlValue}
                        disabled={laneControlDisabled}
                        onChange={(event) =>
                            onChange((data) => ({
                                ...data,
                                lane: getLaneForCardSide(
                                    event.target.value as LaneControlValue,
                                    focusSide,
                                ),
                            }))
                        }
                    >
                        {laneControlOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            <label className={styles.field}>
                <span>Text</span>
                <textarea
                    value={node.data.text}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            text: event.target.value,
                        }))
                    }
                />
            </label>
        </div>
    );
}
