import { useEffect, useRef, useState } from "react";
import type { EditorSectionId } from "./editor-sections.ts";
import { focusEditorTarget } from "./editor-navigation.ts";

type NavigationTarget = { sectionId: EditorSectionId; subsectionId?: string };

export function useEditorNavigation(sectionId: EditorSectionId) {
    const contentRef = useRef<HTMLDivElement>(null);
    const previousSection = useRef(sectionId);
    const [target, setTarget] = useState<NavigationTarget | null>(null);

    useEffect(() => {
        const changed = previousSection.current !== sectionId;
        previousSection.current = sectionId;
        // Skip mounting and ordinary draft/save updates. Controlled navigation waits for its render.
        if ((!changed && !target) || (target && target.sectionId !== sectionId)) return;
        if (contentRef.current) focusEditorTarget(contentRef.current, sectionId, target?.subsectionId);
        if (target) setTarget(null);
    }, [sectionId, target]);

    function requestTarget(nextSection: EditorSectionId, subsectionId?: string) {
        setTarget({ sectionId: nextSection, subsectionId });
    }

    return { contentRef, requestTarget };
}
