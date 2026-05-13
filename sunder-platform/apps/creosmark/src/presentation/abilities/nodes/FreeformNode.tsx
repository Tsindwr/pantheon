import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityLane, FreeformNodeType } from "../../../domain";
import NodeDeleteButton from "./NodeDeleteButton";

function LaneBadge({ lane }: { lane: AbilityLane }) {
    return <span className={styles.laneBadge}>{lane}</span>;
}

export default function FreeformNode({ id, data, selected }: NodeProps<FreeformNodeType>) {
    return (
        <div className={`${styles.node} ${styles.freeformNode} ${selected ? styles.nodeSelected : ""}`}>
            <NodeDeleteButton id={id} visible={selected} />
            <Handle type={"target"} position={Position.Top} className={styles.handle} />
            <div className={styles.nodeHeader}>
                <span className={styles.nodeEyebrow}>fallback</span>
                <strong>{data.title}</strong>
            </div>
            <LaneBadge lane={data.lane} />
            <p className={styles.nodeCopy}>{data.text}</p>
            <Handle type={"source"} position={Position.Bottom} className={styles.handle} />
        </div>
    );
}
