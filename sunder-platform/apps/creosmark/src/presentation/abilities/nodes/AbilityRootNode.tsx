import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityRootNodeType } from "../../../domain";
import NodeDeleteButton from "./NodeDeleteButton";

export default function AbilityRootNode({ id, data, selected }: NodeProps<AbilityRootNodeType>) {
    return (
        <div className={`${styles.node} ${styles.rootNode} ${selected ? styles.nodeSelected : ""}`}>
            <NodeDeleteButton id={id} visible={selected} />
            <Handle type={"target"} position={Position.Top} className={styles.handle} />
            <div className={styles.nodeHeader}>
                <span className={styles.nodeEyebrow}>{data.abilityKind}</span>
                <strong>{data.title}</strong>
            </div>
            <p className={styles.nodeCopy}>{data.summary || "Describe the card's job."}</p>
            <Handle type={"source"} position={Position.Bottom} className={styles.handle} />
        </div>
    );
}
