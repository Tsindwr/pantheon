# Creosmark UX PBI Backlog

Created: 2026-08-06

Scope: character builder editor workspace, ability builder workspace, and character sheet ability playmat in `apps/creosmark`.

This backlog expands the UX audit into GitHub-ready PBIs. The companion CSV at `sunder-platform/docs/creosmark-ux-github-issues.csv` contains one row per issue, with title, body, labels, milestone, priority, size, phase, and dependencies. The helper script at `sunder-platform/docs/import-creosmark-ux-github-issues.ps1` can dry-run or create issues through GitHub CLI.

## Import Notes

- Suggested GitHub milestones: `Creosmark UX Phase 1`, `Creosmark UX Phase 2`, `Creosmark UX Phase 3`.
- Suggested labels are encoded in the CSV as semicolon-separated values.
- The script defaults to dry-run. Use `-Execute` only after labels and milestones exist in the target repository.
- PBIs are intentionally scoped as product backlog items, not implementation tasks. Engineering can split a PBI if discovery shows a larger technical surface.

## Source Anchors

- Character builder shell: `sunder-platform/apps/creosmark/src/components/builder/CharacterBuilderShell.tsx`
- Editor workspace: `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.tsx`
- Ability builder shell: `sunder-platform/apps/creosmark/src/components/abilities/AbilityBuilderShell.tsx`
- Ability builder sidebar: `sunder-platform/apps/creosmark/src/components/abilities/BuilderSidebar.tsx`
- Ability builder workspace: `sunder-platform/apps/creosmark/src/components/abilities/BuilderWorkspace.tsx`
- Ability playmat: `sunder-platform/apps/creosmark/src/components/abilities/CharacterAbilitiesPanel.tsx`

## Prioritized Backlog

| ID | Area | Title | Phase | Priority | Impact | Complexity | Type | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-001 | Editor | Unified progress rail replacing dual step/tab mental model | 2 | P0 | High | Medium | Structural | UX-006, UX-019, UX-020 |
| UX-002 | Editor | Sticky you-are-here breadcrumb in long sections | 1 | P1 | Medium | Small | Quick win | UX-006 |
| UX-003 | Builder | Build flow stages for structure, rules, card, and publish | 2 | P0 | High | Medium | Structural | UX-007, UX-021 |
| UX-004 | Playmat | Explicit zone labels and turn-priority legend | 1 | P1 | Medium | Small | Quick win | None |
| UX-005 | Editor | Collapse advanced controls by default | 1 | P1 | High | Small | Quick win | None |
| UX-006 | Editor | Live section summary cards | 1 | P0 | High | Small | Quick win | None |
| UX-007 | Builder | Pinned blocking validation panel | 1 | P0 | High | Small | Quick win | None |
| UX-008 | Playmat | Ready-now versus situational card states | 3 | P0 | High | Medium | Structural | UX-004, UX-024 |
| UX-009 | Editor | Bulk skill and proficiency operations | 2 | P1 | Medium | Medium | Structural | UX-019, UX-020 |
| UX-010 | Editor | Inline quick-edit chips for common fields | 2 | P2 | Medium | Small | Quick win | UX-006 |
| UX-011 | Builder | Keyboard-first node creation palette search | 2 | P0 | High | Medium | Structural | UX-025, UX-028 |
| UX-012 | Builder | Snap, grid alignment, and auto-layout suggestions | 2 | P1 | Medium | Medium | Structural | UX-011 |
| UX-013 | Playmat | Pin active card without spotlight modal | 3 | P0 | High | Medium | Structural | UX-024 |
| UX-014 | Playmat | Explicit one-click face toggle affordance | 1 | P1 | Medium | Small | Quick win | UX-028 |
| UX-015 | Editor | First-run guided checklist by section | 2 | P0 | High | Medium | Structural | UX-006, UX-033 |
| UX-016 | Builder | Interactive starter templates by intent | 2 | P1 | High | Medium | Structural | UX-003 |
| UX-017 | Builder | Contextual helper text for empty and invalid states | 1 | P1 | Medium | Small | Quick win | UX-007 |
| UX-018 | Playmat | Dismissible playmat coach marks | 1 | P2 | Medium | Small | Quick win | UX-004 |
| UX-019 | Editor | Explicit save timeline with retry | 1 | P0 | High | Small | Quick win | None |
| UX-020 | Editor | Unsaved-change guard before route leave | 1 | P0 | High | Small | Quick win | UX-019 |
| UX-021 | Builder | Publish preflight panel | 2 | P0 | High | Medium | Structural | UX-007 |
| UX-022 | Builder | Post-upload success path | 1 | P1 | Medium | Small | Quick win | UX-021 |
| UX-023 | Playmat | Recollect modal validation hints | 1 | P1 | Medium | Small | Quick win | None |
| UX-024 | Playmat | Action-use feedback and cooldown badges | 3 | P0 | High | Medium | Structural | UX-008 |
| UX-025 | All | Full keyboard traversal for critical workflows | 2 | P0 | High | Medium | Structural | UX-026, UX-028 |
| UX-026 | All | Modal focus management improvements | 1 | P0 | High | Small | Quick win | None |
| UX-027 | All | Color contrast hardening for critical UI states | 1 | P0 | High | Small | Quick win | None |
| UX-028 | Builder, Playmat | Non-visual labels for icon-only controls | 1 | P1 | Medium | Small | Quick win | None |
| UX-029 | Editor | Mobile section chunking and sticky action row | 2 | P1 | High | Medium | Structural | UX-001, UX-019 |
| UX-030 | Builder | Adaptive single-column mode under 1100px | 2 | P1 | High | Medium | Structural | UX-003 |
| UX-031 | Playmat | Small-screen tactical list/grid mode | 3 | P1 | High | Medium | Structural | UX-008, UX-024 |
| UX-032 | Playmat | Gesture-safe tap targets and spacing pass | 3 | P2 | Medium | Small | Quick win | UX-031 |
| UX-033 | Editor | Character readiness panel | 2 | P0 | High | Medium | Structural | UX-006 |
| UX-034 | Builder | Ability ownership and visibility status in header | 1 | P2 | Medium | Small | Quick win | None |
| UX-035 | Builder, Editor | Direct assign-to-character flow after publish | 2 | P0 | High | Medium | Structural | UX-022, UX-033 |
| UX-036 | Playmat | Shareable loadout snapshot | 3 | P2 | Medium | Medium | Structural | UX-008 |
| UX-037 | Editor | Skeleton placeholders for pickers and transitions | 1 | P2 | Medium | Small | Quick win | UX-019 |
| UX-038 | Builder | Progressive loading for graph and card assets | 2 | P2 | Medium | Medium | Structural | UX-030 |
| UX-039 | Playmat | Card prefetch and fast spotlight transitions | 3 | P2 | Medium | Small | Quick win | UX-013 |
| UX-040 | All | Latency messaging standards | 1 | P1 | Medium | Small | Quick win | UX-019, UX-021 |

## Expanded PBIs

### UX-001 - Editor: Unified Progress Rail Replacing Dual Step/Tab Mental Model

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: `CharacterBuilderShell` exposes numbered steps while `EditorWorkspace` has its own tab model. Users can lose orientation when the same editor is reached from builder and management contexts.

User story: As a character author, I want one primary progress rail with section status, so I can move through creation and editing without guessing where I am or what remains.

Acceptance criteria:

1. A shared section model drives both builder and editor navigation for identity, origin, levels, potentials, proficiencies, abilities, and goals.
2. Only one primary navigation model is visible at a time for those sections.
3. The active section, incomplete required fields, blocking validation count, and save state are visible globally.
4. Selecting a section preserves local edits and moves focus to that section heading.
5. Rail controls are keyboard reachable and expose `aria-current` or equivalent state.

Implementation notes: Reconcile `BUILDER_STEPS` and `EDITOR_TABS` into a shared section definition. This PBI should reuse the summary data introduced by UX-006 and the save-state language from UX-019.

Dependencies: UX-006, UX-019, UX-020.

### UX-002 - Editor: Sticky You-Are-Here Breadcrumb in Long Sections

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Long form sections make it difficult to tell which section and subsection is being edited after scrolling.

User story: As a character editor, I want a sticky breadcrumb that names my current section and subsection, so I can stay oriented during long editing sessions.

Acceptance criteria:

1. A sticky breadcrumb or compact header remains visible while scrolling within the editor workspace.
2. It shows the active section and nearest subsection label.
3. It includes a compact completion indicator when summary data is available.
4. It does not cover form controls at mobile or desktop widths.
5. It can be dismissed or condensed if it conflicts with a modal or picker.

Implementation notes: The first version can key off the current tab or forced section. Subsection detection can start with static anchors and improve later with intersection observers.

Dependencies: UX-006.

### UX-003 - Builder: Build Flow Stages for Structure, Rules, Card, and Publish

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: The ability builder currently exposes tree view, card view, and upload controls, but users must infer the intended order and what blocks progress.

User story: As an ability author, I want a staged build flow, so I know whether I should be working on structure, rules, card mapping, or publish readiness.

Acceptance criteria:

1. The builder header shows stages for Structure, Rules, Card, and Publish.
2. Each stage displays complete, warning, or blocked status based on graph summary, rule checks, and card issues.
3. Users can move backward freely and can move forward when blockers are resolved.
4. Existing tree and card views remain available to expert users.
5. The current publish button state names the exact blocking stage instead of relying only on disabled state.

Implementation notes: Start by mapping existing `summary.warnings`, `hasInvalidState`, `cardIssues`, and `canPublish` into a shared stage status model.

Dependencies: UX-007, UX-021.

### UX-004 - Playmat: Explicit Zone Labels and Turn-Priority Legend

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: The playmat has trait, surge, and action zones, but the dense visual metaphor can make combat relevance unclear.

User story: As a player, I want each playmat zone and priority rule labeled, so I can quickly tell which cards are always on, available now, or conditional.

Acceptance criteria:

1. Trait, surge, and action zones have persistent labels that are visible without hover.
2. A compact legend explains ready, used, exhausted, conditional, and passive states once those states exist.
3. Labels remain readable when the playmat has many cards.
4. Labels do not interfere with hand fan interaction or spotlight activation.
5. Screen readers can identify each zone and its card count.

Implementation notes: This can start with static labels and counts from `traitCards`, `surgeCards`, and `actionCards`.

Dependencies: None.

### UX-005 - Editor: Collapse Advanced Controls by Default

Priority: P1. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: The editor exposes many controls at once, increasing scan cost for common create/edit tasks.

User story: As a newer character author, I want advanced options collapsed by default, so I can complete required choices before tuning edge cases.

Acceptance criteria:

1. Advanced or less frequently used controls are grouped under explicit expandable panels.
2. Required fields and common decisions remain visible by default.
3. Collapsed panels show a summary count of configured values or missing required values.
4. Expansion state persists during the current editing session.
5. No existing editing capability is removed.

Implementation notes: Candidate panels include advanced origin details, archetype boon details, optional goal metadata, and dense potential/perk controls.

Dependencies: None.

### UX-006 - Editor: Live Section Summary Cards

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: Users do not have a compact view of completion, missing choices, or section-level validation while moving through character creation.

User story: As a character editor, I want live section summaries, so I can see what is complete and jump directly to missing inputs.

Acceptance criteria:

1. Each primary editor section exposes a summary with counts, missing required values, and blocking issues.
2. Summary items link or scroll to the relevant input.
3. The summary updates immediately when the sheet changes.
4. Summaries are available to the progress rail, breadcrumb, and readiness panel.
5. Empty or unknown states are explicit rather than blank.

Implementation notes: Implement a pure summary derivation layer first. Avoid coupling summary calculation directly to JSX so later PBIs can reuse it.

Dependencies: None.

### UX-007 - Builder: Pinned Blocking Validation Panel

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: Rule and card issues exist, but they are distributed across sidebar states and can be hidden while users work in another view.

User story: As an ability author, I want blocking validation pinned at the top of the builder, so I always know the next issue to fix.

Acceptance criteria:

1. Blocking issues are visible in both tree and card views.
2. Issues are grouped by severity: blocking, warning, and note.
3. Each issue provides a target action such as select node, open inspector, switch to card view, or edit card module.
4. The panel collapses when there are no blocking issues but still shows a ready state.
5. The publish button uses the same severity model.

Implementation notes: Use existing `summary.warnings`, budget warnings, card issues, and publish guards as inputs.

Dependencies: None.

### UX-008 - Playmat: Ready-Now Versus Situational Card States

Priority: P0. Phase: 3. Type: Structural. Impact: High. Complexity: Medium.

Problem: During play, cards with different timing, reset, or condition requirements can look equally available.

User story: As a player in combat, I want cards marked as ready now or situational, so I can identify my usable options without reading every card.

Acceptance criteria:

1. Cards receive visible state badges for ready, conditional, passive, used, and unavailable states.
2. Users can filter or sort cards by state without losing the current spotlight or pinned card.
3. The state model accounts for action economy and reset condition in the published ability document.
4. State badges have accessible names and do not rely on color alone.
5. Existing action, surge, trait, default action, and temporary recollect cards are all classified.

Implementation notes: This PBI should establish the card state model used by UX-024, UX-031, and UX-036.

Dependencies: UX-004, UX-024.

### UX-009 - Editor: Bulk Skill and Proficiency Operations

Priority: P1. Phase: 2. Type: Structural. Impact: Medium. Complexity: Medium.

Problem: Repetitive skill and proficiency edits are slow when users need to tune many selections.

User story: As a character editor, I want bulk add, remove, and reset operations for skills and proficiencies, so I can make repeated changes quickly.

Acceptance criteria:

1. Users can select multiple skills or proficiencies and apply add, remove, or reset operations.
2. Bulk operations show a confirmation summary before applying destructive changes.
3. Each operation is undoable within the current editing session.
4. Validation prevents illegal duplicate or blocked selections.
5. Bulk changes update section summaries and save state immediately.

Implementation notes: Use existing command-layer functions where possible. If no undo model exists, scope undo to the latest bulk operation.

Dependencies: UX-019, UX-020.

### UX-010 - Editor: Inline Quick-Edit Chips for Common Fields

Priority: P2. Phase: 2. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Common edits such as changing origin facets or archetype choices require opening dense sections or modals.

User story: As a returning editor, I want inline quick-edit chips for common identity, origin, and archetype fields, so I can make frequent changes in a few interactions.

Acceptance criteria:

1. Summary cards expose quick-edit chips for high-frequency fields.
2. Editing a chip opens the smallest viable control: inline select, popover, or existing picker.
3. Common edits are possible in no more than two interactions after the field is visible.
4. Changes update the underlying section controls and summaries.
5. Quick edits follow modal and focus rules from UX-026.

Implementation notes: Start with character name, origin facet names, selected origin skill, active archetypes, and assigned bloodline ability.

Dependencies: UX-006.

### UX-011 - Builder: Keyboard-First Node Creation Palette Search

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: The graph authoring path depends heavily on drag and drop, which slows expert users and blocks keyboard-only users.

User story: As an ability author, I want a searchable node creation palette, so I can add blocks without precision dragging.

Acceptance criteria:

1. A command palette opens from a button and keyboard shortcut.
2. Users can search palette items by name, category, and related rule term.
3. Selecting an item inserts the node near the selected node, viewport center, or current cursor target.
4. The newly created node is selected and announced to assistive technology.
5. The drag-and-drop path remains available.

Implementation notes: Reuse `buildPaletteSections()` as the source of searchable palette items.

Dependencies: UX-025, UX-028.

### UX-012 - Builder: Snap, Grid Alignment, and Auto-Layout Suggestions

Priority: P1. Phase: 2. Type: Structural. Impact: Medium. Complexity: Medium.

Problem: Graph layout can become visually noisy, making relationships harder to read and edit.

User story: As an ability author, I want layout aids, so I can keep the graph readable without manual positioning work.

Acceptance criteria:

1. Nodes snap to a visible grid when moved unless users disable snapping.
2. A tidy layout command arranges nodes while preserving existing links and selected node context.
3. Auto-layout can be previewed before applying when the graph has more than a small number of nodes.
4. Undo restores the previous layout.
5. Layout actions do not alter ability rules or card data.

Implementation notes: Evaluate React Flow layout helpers or a small directed graph layout library before hand-rolling.

Dependencies: UX-011.

### UX-013 - Playmat: Pin Active Card Without Spotlight Modal

Priority: P0. Phase: 3. Type: Structural. Impact: High. Complexity: Medium.

Problem: Spotlight is useful for detail, but during a turn players need a persistent active board state that does not require a modal context switch.

User story: As a player, I want to pin my active card to the playmat, so I can keep turn context visible while choosing other cards.

Acceptance criteria:

1. Any action, surge, or trait card can be pinned and unpinned.
2. The pinned card remains visible while hands and zones remain interactive.
3. Pin state persists during the current turn and clears when explicitly reset.
4. Spotlight can still be opened for full detail without losing pin state.
5. Keyboard users can pin, unpin, and move focus between pinned card and card zones.

Implementation notes: Introduce a pinned-card region distinct from the existing spotlight modal state.

Dependencies: UX-024.

### UX-014 - Playmat: Explicit One-Click Face Toggle Affordance

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Face toggling exists through card interactions, but the control can be easy to miss and is not clearly exposed for all card trays.

User story: As a player, I want an obvious face toggle control on two-sided cards, so I can flip attack and movement faces without opening the card.

Acceptance criteria:

1. Two-sided cards show a persistent flip control when face toggling is available.
2. The control is reachable by keyboard and has an accessible label naming the next face.
3. Toggling updates tray preview and spotlight preview consistently.
4. The control is large enough for touch interaction.
5. Single-face cards do not show a disabled or misleading flip control.

Implementation notes: Build on existing `toggleCardFace` and `toggleSpotlightFace` behavior.

Dependencies: UX-028.

### UX-015 - Editor: First-Run Guided Checklist by Section

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: New users can create a character, but they must infer a valid completion path from dense controls and external rules knowledge.

User story: As a first-time character author, I want a guided checklist by section, so I can complete a valid character without leaving the builder.

Acceptance criteria:

1. First-run checklist items are grouped by editor section.
2. Each checklist item explains the decision to make and links to the relevant input.
3. Completed items update live as the sheet changes.
4. Users can dismiss the checklist for the current character and reopen it later.
5. Checklist content is compatible with edit mode and does not block expert workflows.

Implementation notes: Use readiness and section summary derivations rather than duplicating validation rules in presentation components.

Dependencies: UX-006, UX-033.

### UX-016 - Builder: Interactive Starter Templates by Intent

Priority: P1. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: Blank Action and Blank Surge presets help, but users still need to know which blocks create common ability shapes.

User story: As an ability author, I want starter templates by intent, so I can begin from a melee, spell, support, defensive, or utility pattern.

Acceptance criteria:

1. Template picker includes at least melee attack, ranged attack, spell effect, support, defensive reaction, and utility action.
2. Applying a template creates graph nodes, rule selections, and card defaults.
3. Users can preview the template summary before applying it.
4. Applying a template to a non-empty graph requires confirmation and is undoable.
5. Templates work with the staged flow from UX-003.

Implementation notes: Extend the current preset concept used by `loadPreset("action")` and `loadPreset("surge")`.

Dependencies: UX-003.

### UX-017 - Builder: Contextual Helper Text for Empty and Invalid States

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Empty selection and invalid states often tell users what is missing but not what to do next.

User story: As an ability author, I want contextual helper text, so I can recover from empty or invalid states without guessing.

Acceptance criteria:

1. Empty palette, inspector, graph, card inventory, and card inspector states each offer a next action.
2. Invalid states include a remediation link or button when the target is known.
3. Helper text uses consistent language with the validation panel.
4. Help content does not appear as a blocking error when it is only guidance.
5. Screen readers receive the same next-action guidance.

Implementation notes: Target `BuilderSidebar` empty inspector and card issue regions first.

Dependencies: UX-007.

### UX-018 - Playmat: Dismissible Playmat Coach Marks

Priority: P2. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: The playmat has several custom interaction patterns that are not obvious on first use.

User story: As a first-time playmat user, I want brief coach marks, so I can understand zones, flipping, spotlight, and recollect without reading external documentation.

Acceptance criteria:

1. Coach marks appear once per user or browser profile.
2. Coach marks identify zones, face toggling, spotlight, and recollect when applicable.
3. Users can dismiss all coach marks and reopen them from a help control.
4. Coach marks do not block critical play controls.
5. Coach marks respect reduced motion settings.

Implementation notes: Store dismissal in local storage unless a user preference store already exists.

Dependencies: UX-004.

### UX-019 - Editor: Explicit Save Timeline With Retry

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: The builder shows basic saving states, but long editing sessions need more confidence about when data was saved and how to recover from errors.

User story: As a character editor, I want an explicit save timeline, so I know whether my latest changes are saved and can retry failures.

Acceptance criteria:

1. The header shows saving, saved, unsaved, offline, and error states using consistent language.
2. Saved state includes last saved time when available.
3. Error state includes retry action and concise failure text.
4. Status is not hidden behind a view-character affordance.
5. Save status is announced politely to assistive technology when it changes.

Implementation notes: `CharacterBuilderShell` already receives `saveState`; this PBI may require passing richer metadata from the page entry.

Dependencies: None.

### UX-020 - Editor: Unsaved-Change Guard Before Route Leave

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: Users can navigate away from long editing sessions without a clear warning when local edits are pending or save failed.

User story: As a character editor, I want a guard before leaving with unsaved changes, so I do not lose work accidentally.

Acceptance criteria:

1. Route changes, browser unload, and view-sheet transitions detect pending unsaved edits.
2. Users receive a clear prompt only when there are unsaved local changes or a save error.
3. Users can stay, discard, or retry save when supported.
4. The guard is not triggered when there are no local changes.
5. Automated tests cover pending, saved, and error states.

Implementation notes: Pair this with the richer save timeline from UX-019 to avoid duplicate state models.

Dependencies: UX-019.

### UX-021 - Builder: Publish Preflight Panel

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: Upload readiness is currently compressed into button disabled state, tooltip text, and distributed rule/card errors.

User story: As an ability author, I want a publish preflight panel, so I understand exactly what will publish and what must be fixed first.

Acceptance criteria:

1. Preflight panel lists blocking issues, warnings, notes, and data quality checks.
2. Publish is blocked only by blocking issues.
3. Each issue links to the graph node, card module, or metadata field that resolves it.
4. The panel summarizes title, ability kind, action economy, reset condition, cost, and visibility.
5. Publish action shows sending, success, retryable error, and non-retryable error states.

Implementation notes: Reuse validation severity from UX-007 and feed state into the staged flow from UX-003.

Dependencies: UX-007.

### UX-022 - Builder: Post-Upload Success Path

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Successful upload confirms publication but does not clearly guide the user to the next useful action.

User story: As an ability author, I want success actions after upload, so I can view, assign, or continue editing the published ability.

Acceptance criteria:

1. Success state includes direct actions for view in library and assign to character when the ability id is available.
2. Success state clearly names whether the current graph still has unpublished local changes.
3. Users can dismiss success messaging without losing access to the published id.
4. Success actions are keyboard reachable.
5. Error state remains visually distinct from success state.

Implementation notes: Start by expanding the existing `publishResult` success region in `BuilderWorkspace`.

Dependencies: UX-021.

### UX-023 - Playmat: Recollect Modal Validation Hints

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Recollect assignment choices can be invalid or confusing, and users need feedback before applying changes.

User story: As a player resolving Recollect, I want inline validation hints for each perk assignment, so I can fix mistakes before applying.

Acceptance criteria:

1. Each Recollect row shows whether the selected face is valid, duplicate, unavailable, or unchanged.
2. The Apply Recollect button is disabled only when the current assignment set cannot be applied.
3. Invalid reasons are shown inline and exposed to screen readers.
4. Users can reset assignments to the initial recommended layout.
5. The modal handles missing potential or missing recorded perks with actionable guidance.

Implementation notes: Reuse `getRecollectFaceOptions`, `getSelectedRecollectFaces`, and potential lookup logic.

Dependencies: None.

### UX-024 - Playmat: Action-Use Feedback and Cooldown Badges

Priority: P0. Phase: 3. Type: Structural. Impact: High. Complexity: Medium.

Problem: After cards are used, the playmat does not provide enough turn-state feedback about used, cooldown, or reset status.

User story: As a player, I want immediate action-use feedback, so I can track what is spent, cooling down, or reset this turn.

Acceptance criteria:

1. Users can mark actions and surges as used without leaving the playmat.
2. Used cards update visually immediately and remain distinguishable from ready cards.
3. Reset/cooldown badges use the ability document reset condition where available.
4. Users can reset all turn state from a clear turn control.
5. State changes are keyboard accessible and reversible within the current turn.

Implementation notes: Define a local turn-state model first. Persist only if the product needs cross-device play state.

Dependencies: UX-008.

### UX-025 - All: Full Keyboard Traversal for Critical Workflows

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: Critical editor, builder, graph, card, and playmat workflows still rely on mouse-optimized interaction paths.

User story: As a keyboard-only user, I want to complete critical workflows without a mouse, so I can create, edit, publish, and play effectively.

Acceptance criteria:

1. Critical workflows in editor modals, builder graph essentials, card view, and playmat can be completed by keyboard.
2. Keyboard order follows the visual workflow order.
3. Shortcuts are discoverable through accessible controls or command surfaces.
4. Focus is never trapped except inside active modal dialogs.
5. Regression tests or manual QA scripts cover the critical keyboard paths.

Implementation notes: This is a cross-cutting PBI. Break into implementation tasks by surface after the first accessibility inventory.

Dependencies: UX-026, UX-028.

### UX-026 - All: Modal Focus Management Improvements

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: Multiple modal workflows exist, and focus return must be reliable to avoid disorientation and accessibility failures.

User story: As a keyboard or assistive technology user, I want modal focus handled consistently, so I return to the control that opened the modal.

Acceptance criteria:

1. Opening a modal moves focus to its title or first meaningful control.
2. Closing a modal returns focus to the invoking control when it still exists.
3. Escape closes dismissible modals consistently.
4. Background content is not reachable while a modal is open.
5. Origin picker, archetype modal, spotlight, and Recollect modal are covered.

Implementation notes: Consider a shared modal primitive before patching each modal independently.

Dependencies: None.

### UX-027 - All: Color Contrast Hardening for Critical UI States

Priority: P0. Phase: 1. Type: Quick win. Impact: High. Complexity: Small.

Problem: Low-opacity labels, badges, and status text can reduce readability, especially in dense editor and playmat states.

User story: As a user with low vision or challenging display conditions, I want critical text and controls to meet contrast standards, so I can read and act confidently.

Acceptance criteria:

1. Critical text, form labels, buttons, badges, errors, and selected states meet WCAG AA contrast.
2. Disabled controls remain distinguishable without being mistaken for enabled controls.
3. Validation severity does not rely on color alone.
4. Contrast changes are applied across editor, builder, and playmat CSS modules.
5. A documented contrast check is attached to the issue before closure.

Implementation notes: Audit CSS modules for low-opacity text and badge colors before implementation.

Dependencies: None.

### UX-028 - Builder, Playmat: Non-Visual Labels for Icon-Only Controls

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Icon-only or visually compact controls need consistent names for screen readers and tooltips.

User story: As an assistive technology user, I want every icon-only control to have a non-visual label, so I know what action it performs.

Acceptance criteria:

1. Every icon-only or symbol-only control in builder and playmat has an `aria-label` or visible text equivalent.
2. Controls with changing state include the target state in the accessible name when useful.
3. Tooltips or titles are provided for unfamiliar icon actions.
4. Automated or manual accessibility checks confirm no unnamed critical controls remain.
5. Labels use product vocabulary consistently.

Implementation notes: Prioritize builder toolbar controls, face toggles, spotlight controls, and playmat zone actions.

Dependencies: None.

### UX-029 - Editor: Mobile Section Chunking and Sticky Action Row

Priority: P1. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: High-density editor forms are difficult to scan and operate on small screens.

User story: As a mobile character editor, I want sections chunked with sticky actions, so I can make changes without excessive scrolling or losing save/navigation controls.

Acceptance criteria:

1. Editor sections are chunked into mobile-friendly subsections under the breakpoint selected by design.
2. Save status, section navigation, and primary action remain reachable through a sticky action row.
3. Form controls avoid horizontal overflow and maintain readable labels.
4. Modals and pickers fit mobile viewports without hidden actions.
5. Mobile QA covers identity, origin, levels, potentials, proficiencies, abilities, and goals.

Implementation notes: This should follow the unified navigation model from UX-001 instead of adding another mobile-only navigation scheme.

Dependencies: UX-001, UX-019.

### UX-030 - Builder: Adaptive Single-Column Mode Under 1100px

Priority: P1. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: The builder split layout can crowd the graph, sidebar, card view, and toolbar on medium and small screens.

User story: As an ability author on a smaller screen, I want an adaptive single-column mode, so I can reach the palette, inspector, graph, and card view without horizontal scrolling.

Acceptance criteria:

1. Under 1100px, sidebar and workspace adapt to a single-column or collapsible rail layout.
2. Palette, inspector, stage status, graph, and card view remain reachable.
3. Toolbars wrap or condense without overlapping.
4. React Flow controls remain visible and usable.
5. No horizontal page overflow appears at 1100px, 900px, 760px, and 390px widths.

Implementation notes: Coordinate with the staged flow from UX-003 so responsive layout preserves workflow order.

Dependencies: UX-003.

### UX-031 - Playmat: Small-Screen Tactical List/Grid Mode

Priority: P1. Phase: 3. Type: Structural. Impact: High. Complexity: Medium.

Problem: Fan overlap and stacked previews can reduce card readability on small screens.

User story: As a mobile player, I want a tactical list or grid mode, so I can read and use my abilities during play on a small screen.

Acceptance criteria:

1. At small breakpoints, the action fan is replaced by a readable list or grid.
2. Ready, used, conditional, and pinned states remain visible.
3. Face toggles and spotlight or detail actions remain touch friendly.
4. Trait and surge zones remain distinct from action cards.
5. Mobile QA confirms no overlapping text or inaccessible controls below 760px.

Implementation notes: Build on the state model from UX-008 and turn tracking from UX-024.

Dependencies: UX-008, UX-024.

### UX-032 - Playmat: Gesture-Safe Tap Targets and Spacing Pass

Priority: P2. Phase: 3. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Dense tray and card controls can be difficult to tap accurately on compact screens.

User story: As a touch user, I want comfortable tap targets and spacing, so I can use cards without accidental activation.

Acceptance criteria:

1. Critical tap targets meet the agreed minimum target size.
2. Adjacent destructive or state-changing controls have enough spacing to avoid accidental taps.
3. Card preview, face toggle, pin, use, and close controls are included.
4. Tap target changes do not cause card text overlap.
5. Compact and small-screen modes are tested on representative viewport sizes.

Implementation notes: Apply after UX-031 establishes the compact layout shape.

Dependencies: UX-031.

### UX-033 - Editor: Character Readiness Panel

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: The editor does not provide a consolidated readiness view for publish-ready or play-ready character state.

User story: As a character author, I want a readiness panel, so I can resolve missing origin boons, invalid levels, missing abilities, and other blockers before play.

Acceptance criteria:

1. Readiness panel summarizes completion by section and overall readiness.
2. Blocking issues, warnings, and optional polish items are separated.
3. Each readiness item links to the relevant editor section or control.
4. Readiness derives from domain rules or shared summary logic rather than duplicated presentation checks.
5. The panel is usable from both builder and editor entry points.

Implementation notes: This is the authoritative product surface for character validation and should feed UX-015 and UX-035.

Dependencies: UX-006.

### UX-034 - Builder: Ability Ownership and Visibility Status in Header

Priority: P2. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Authors need to know whether an ability is a draft, personal, public, admin, or otherwise constrained before publishing or assigning it.

User story: As an ability author, I want ownership and visibility status in the builder header, so I understand where the ability will be available.

Acceptance criteria:

1. Builder header shows draft/published state and visibility or ownership status when known.
2. Status is included in publish preflight once UX-021 exists.
3. Unknown or unavailable status is explicit and non-blocking.
4. Status text is accessible and meets contrast requirements.
5. The status updates after successful publish.

Implementation notes: If the current builder only knows publish result after upload, start with draft/local and published status and expand when repository data is available.

Dependencies: None.

### UX-035 - Builder, Editor: Direct Assign-to-Character Flow After Publish

Priority: P0. Phase: 2. Type: Structural. Impact: High. Complexity: Medium.

Problem: Publishing an ability and using it on a character are separate workflows, forcing users to manually search or copy identifiers.

User story: As an ability author, I want to assign a published ability directly to a character, so I can test and play it without leaving the workflow.

Acceptance criteria:

1. After publish, users can open an assign-to-character flow from the success state.
2. The flow lists eligible characters and indicates readiness or assignment blockers.
3. Assigning adds the ability to the selected character without manual id entry.
4. Success provides a direct path to the character sheet playmat.
5. Failure states explain whether the issue is permissions, validation, network, or missing character data.

Implementation notes: Use `publishResult` for the ability id and the readiness model from UX-033 for character-side blockers.

Dependencies: UX-022, UX-033.

### UX-036 - Playmat: Shareable Loadout Snapshot

Priority: P2. Phase: 3. Type: Structural. Impact: Medium. Complexity: Medium.

Problem: Players and GMs have limited support for comparing or sharing a selected ability set for planning.

User story: As a player or GM, I want to export and import a loadout snapshot, so party planning can happen without rebuilding selections manually.

Acceptance criteria:

1. Users can export the current playmat loadout, including ability ids and relevant local playmat state.
2. Users can import a compatible snapshot and see unresolved or unavailable abilities before applying.
3. Exported data avoids private character details not required for loadout planning.
4. Imported snapshots do not overwrite current assignments without confirmation.
5. Snapshot format includes a version field for future compatibility.

Implementation notes: Treat this as a planning and comparison artifact, not as authoritative character persistence.

Dependencies: UX-008.

### UX-037 - Editor: Skeleton Placeholders for Pickers and Transitions

Priority: P2. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Async pickers and section transitions can show blank or abrupt states, reducing perceived reliability.

User story: As a character editor, I want loading placeholders, so I can tell the app is working while picker data or section UI loads.

Acceptance criteria:

1. Origin picker search/loading states show skeleton or structured placeholders rather than blank panels.
2. Section transitions preserve layout dimensions where possible.
3. Loading, empty, and error states use the latency language standard from UX-040.
4. Placeholders do not steal focus from active inputs.
5. Loading state remains accessible to screen readers.

Implementation notes: Start with origin picker states backed by `originPickerLoading`, `originPickerError`, and `originPickerRows`.

Dependencies: UX-019.

### UX-038 - Builder: Progressive Loading for Graph and Card Assets

Priority: P2. Phase: 2. Type: Structural. Impact: Medium. Complexity: Medium.

Problem: Heavy graph, card, and rendering assets can delay interaction on the builder surface.

User story: As an ability author, I want the builder to become interactive progressively, so I can start working before non-critical assets finish loading.

Acceptance criteria:

1. Critical toolbar and staged status render before non-critical graph/card assets when feasible.
2. Graph and card areas show stable loading states with clear retry paths on failure.
3. Non-critical previews or expensive visual assets are deferred until visible.
4. Interaction readiness is measurable with an agreed latency target.
5. Loading changes do not break import/export or publish flows.

Implementation notes: Evaluate code splitting and lazy rendering around card canvas and React Flow surfaces.

Dependencies: UX-030.

### UX-039 - Playmat: Card Prefetch and Fast Spotlight Transitions

Priority: P2. Phase: 3. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Spotlight interactions should feel immediate because they are core to reading and choosing cards during play.

User story: As a player, I want spotlight detail to open quickly, so I can inspect cards without slowing the turn.

Acceptance criteria:

1. Card data needed for spotlight is prefetched before likely interaction where practical.
2. Spotlight opens within the agreed latency budget on representative data sets.
3. Transition animation respects reduced motion preferences.
4. Loading fallback is shown if card detail cannot be rendered immediately.
5. Prefetch does not block initial playmat interaction.

Implementation notes: Coordinate with the pinned-card model from UX-013 so performance work supports both detail surfaces.

Dependencies: UX-013.

### UX-040 - All: Latency Messaging Standards

Priority: P1. Phase: 1. Type: Quick win. Impact: Medium. Complexity: Small.

Problem: Async paths use inconsistent language such as Loading, Sending, Upload, Retry, or blank states, which can reduce user confidence.

User story: As a user, I want consistent latency and error messaging, so I understand what is happening and what I can do next.

Acceptance criteria:

1. Product copy standards define language for loading, saving, publishing, retrying, offline, empty, and error states.
2. Editor, builder, and playmat async states are updated to use the standard.
3. Every error state includes a next action when one exists.
4. Loading messages avoid implying success before completion.
5. Accessibility announcements use the same language as visible status.

Implementation notes: This can ship as a small copy and component pass, then become a checklist item for future UX work.

Dependencies: UX-019, UX-021.
