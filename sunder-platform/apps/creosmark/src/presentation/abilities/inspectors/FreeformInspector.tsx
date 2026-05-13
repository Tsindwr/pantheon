import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityLane, FreeformData, FreeformNodeType } from "../../../domain";

type FreeformInspectorProps = {
    node: FreeformNodeType;
    onChange: (updater: (data: FreeformData) => FreeformData) => void;
};

export default function FreeformInspector({ node, onChange }: FreeformInspectorProps) {
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

            <label className={styles.field}>
                <span>Lane</span>
                <select
                    value={node.data.lane}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            lane: event.target.value as AbilityLane,
                        }))
                    }
                >
                    <option value="body">Body</option>
                    <option value="focus">Focus</option>
                    <option value="flipside">Flipside</option>
                    <option value="option">Option</option>
                </select>
            </label>

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
