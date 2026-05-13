import { useReactFlow, type Edge } from "@xyflow/react";
import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityBuilderNode } from "../../../domain";

function TrashIcon() {
    return (
        <svg
            viewBox={"0 0 24 24"}
            width={"14"}
            height={"14"}
            aria-hidden={"true"}
            focusable={"false"}
        >
            <path
                fill={"currentColor"}
                d={"M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12a2 2 0 0 1-2-2V8h16v11a2 2 0 0 1-2 2H6Z"}
            />
        </svg>
    );
}

type NodeDeleteButtonProps = {
    id: string;
    visible: boolean;
};

export default function NodeDeleteButton({ id, visible }: NodeDeleteButtonProps) {
    const { setNodes, setEdges } = useReactFlow<AbilityBuilderNode, Edge>();

    if (!visible) return null;

    return (
        <button
            type={"button"}
            className={`nodrag nopan ${styles.nodeDeleteButton}`}
            aria-label={"Delete node"}
            title={"Delete node"}
            onMouseDown={(event) => {
                event.stopPropagation();
            }}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                setEdges((current) =>
                    current.filter((edge) => edge.source !== id && edge.target !== id),
                );
                setNodes((current) => current.filter((node) => node.id !== id));
            }}
        >
            <TrashIcon />
        </button>
    );
}
