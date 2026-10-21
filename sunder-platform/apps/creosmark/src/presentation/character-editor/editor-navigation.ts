import type { EditorSectionId } from "./editor-sections.ts";

/** Resolve only inside the currently mounted editor, never a previous section or another editor. */
export function focusEditorTarget(
    content: HTMLElement,
    sectionId: EditorSectionId,
    subsectionId?: string,
): boolean {
    const mainHeading = content.querySelector<HTMLElement>(
        `[data-editor-heading="${sectionId}"]`,
    );
    const subsection = subsectionId ? content.querySelector<HTMLElement>(
        `[data-editor-section="${sectionId}"][data-editor-subsection="${subsectionId}"]`,
    ) : null;
    const heading = subsection?.querySelector<HTMLElement>(
        'h3[tabindex="-1"], h4[tabindex="-1"], [role="heading"][tabindex="-1"]',
    ) ?? mainHeading;
    const view = content.ownerDocument.defaultView;
    if (!view || !heading?.isConnected || !content.contains(heading)) return false;

    // The breadcrumb can wrap; measure its actual sticky height rather than assuming one line.
    const breadcrumb = content.querySelector<HTMLElement>('[aria-label="Editor location"]');
    if (breadcrumb) {
        const top = Number.parseFloat(view.getComputedStyle(breadcrumb).top) || 0;
        content.style.setProperty("--editor-navigation-offset",
            `${Math.ceil(top + breadcrumb.getBoundingClientRect().height + 12)}px`);
    }
    heading.scrollIntoView({
        behavior: view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
    });
    heading.focus({ preventScroll: true });
    return true;
}
