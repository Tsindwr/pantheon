declare module "@3d-dice/dice-box" {
    export type DiceBoxConfig = {
        assetPath: string;
        container?: HTMLElement | string;
        id?: string;
        gravity?: number;
        mass?: number;
        friction?: number;
        restitution?: number;
        angularDamping?: number;
        linearDamping?: number;
        spinForce?: number;
        throwForce?: number;
        startingHeight?: number;
        settleTimeout?: number;
        offscreen?: boolean;
        delay?: number;
        lightIntensity?: number;
        enableShadows?: boolean;
        shadowTransparency?: number;
        theme?: string;
        preloadThemes?: Record<string, string>;
        themeColor?: string;
        scale?: number;
        suspendSimulation?: boolean;
        origin?: string;
        onBeforeRoll?: (...args: unknown[]) => void;
        onDieComplete?: (...args: unknown[]) => void;
        onRollComplete?: (...args: unknown[]) => void;
        onRemoveComplete?: (...args: unknown[]) => void;
        onThemeConfigLoaded?: (...args: unknown[]) => void;
        onThemeLoaded?: (...args: unknown[]) => void;
    };

    export default class DiceBox {
        constructor(config: DiceBoxConfig);
        init(): Promise<void>;
        roll(
            notation: string | { qty: number, sides: number } | Array<{ qty: number; sides: number }>,
            options?: Record<string, unknown>,
        ): Promise<unknown>;
        add?(
            notation: string | { qty: number, sides: number } | Array<{ qty: number, sides: number }>,
            options?: Record<string, unknown>,
        ): Promise<unknown>;
        clear(): void;
        getRollResults?(): unknown;
    }
}