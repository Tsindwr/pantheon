import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import {
    type AbilityBuilderValidationIssue,
    useAbilityBuilderContext,
} from "../../../components/abilities/AbilityBuilderContext";

function getBadgeSeverity(issues: AbilityBuilderValidationIssue[]) {
    return issues.some((issue) => issue.severity === "blocking")
        ? "blocking"
        : "warning";
}

export default function NodeValidationBadge({ nodeId }: { nodeId: string }) {
    const {
        nodeValidationIssuesById,
        setSelectedEdgeId,
        setSelectedNodeId,
        setSidebarMode,
    } = useAbilityBuilderContext();
    const issues = nodeValidationIssuesById[nodeId] ?? [];
    if (issues.length === 0) return null;

    const severity = getBadgeSeverity(issues);
    const tooltipText = issues.map((issue) => issue.message).join("\n");
    const inspectNode = () => {
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);
        setSidebarMode("inspector");
    };

    return (
        <span
            className={`nodrag nopan ${styles.nodeValidationBadge} ${
                severity === "blocking"
                    ? styles.nodeValidationBadgeBlocking
                    : styles.nodeValidationBadgeWarning
            }`}
            role="button"
            tabIndex={0}
            aria-label={`${issues.length} validation issue${issues.length === 1 ? "" : "s"}. ${tooltipText}`}
            title={tooltipText}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation();
                inspectNode();
            }}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                inspectNode();
            }}
        >
            <i
                className={`fa-solid fa-${severity === "blocking" ? "triangle-exclamation" : "exclamation"}`}
                aria-hidden="true"
            />
            {issues.length > 1 ? <strong>{issues.length}</strong> : null}
            <span className={styles.nodeValidationTooltip} role="tooltip">
                {issues.map((issue) => (
                    <span key={issue.id}>{issue.message}</span>
                ))}
            </span>
        </span>
    );
}
