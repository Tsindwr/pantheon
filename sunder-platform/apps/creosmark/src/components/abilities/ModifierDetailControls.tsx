import {
    getModifierDetailOptions,
    getModifierDetailSchemas,
    type ModifierData,
} from "../../domain";
import styles from './AbilityBuilderShell.module.css';

type ModifierDetailControlsProps = {
    data: ModifierData;
    compact?: boolean;
    onChange: (selectionId: string, value: string) => void;
};

export default function ModifierDetailControls({
    data,
    compact = false,
    onChange,
}: ModifierDetailControlsProps) {
    const schemas = getModifierDetailSchemas(data);

    if (schemas.length === 0) return null;

    return (
        <div className={compact ? styles.nodeDetailControls : styles.editorStack}>
            {schemas.map((schema) => {
                const options = getModifierDetailOptions(schema);
                if (options.length === 0) return null;

                const preferredValue =
                    data.selectionValues?.[schema.id] ??
                    schema.defaultOptionId ??
                    options[0]?.id ??
                    "";

                const value = options.some((option) => option.id === preferredValue)
                    ? preferredValue
                    : (options[0]?.id ?? "");

                if (compact) {
                    return (
                        <label key={schema.id} className={styles.nodeDetailField}>
                            <span className={styles.nodeDetailLabel}>{schema.label}</span>
                            <select
                                className={`nodrag ${styles.nodeOptionSelect}`}
                                value={value}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => onChange(schema.id, event.target.value)}
                            >
                                {options.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    );
                }

                return (
                    <label key={schema.id} className={styles.field}>
                        <span>{schema.label}</span>
                        <select
                            value={value}
                            onChange={(event) => onChange(schema.id, event.target.value)}
                        >
                            {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                );
            })}
        </div>
    );
}
