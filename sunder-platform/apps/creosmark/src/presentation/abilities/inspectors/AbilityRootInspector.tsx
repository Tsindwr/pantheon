import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityKind, AbilityRootData, AbilityRootNodeType } from "../../../domain";

type AbilityRootInspectorProps = {
    node: AbilityRootNodeType;
    onChange: (updater: (data: AbilityRootData) => AbilityRootData) => void;
};

export default function AbilityRootInspector({ node, onChange }: AbilityRootInspectorProps) {
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
                <span>Kind</span>
                <select
                    value={node.data.abilityKind}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            abilityKind: event.target.value as AbilityKind,
                        }))
                    }
                >
                    <option value="action">Action</option>
                    <option value="surge">Surge</option>
                    <option value="trait">Trait</option>
                    <option value="option">Option</option>
                </select>
            </label>

            <label className={styles.field}>
                <span>Summary</span>
                <textarea
                    value={node.data.summary}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            summary: event.target.value,
                        }))
                    }
                />
            </label>
        </div>
    );
}
