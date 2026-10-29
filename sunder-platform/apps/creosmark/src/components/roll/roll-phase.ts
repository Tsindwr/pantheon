/**
 * Lifecycle states of the interactive dice roller.
 *
 * Shared by the roller and presentation overlays so that
 * rendering components do not depend on each other's types.
 */
export type RollPhase =
    | "idle"
    | "rolling"
    | "resolved"
    | "error";