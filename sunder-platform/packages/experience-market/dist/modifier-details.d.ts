import type { ModifierData } from "./types.js";
export type ModifierDetailSchema = {
    id: string;
    label: string;
    optionPoolId: string;
    defaultOptionId?: string;
    otherOptions?: {
        id: string;
        label: string;
        description?: string;
    }[];
};
export type ModifierDetailOption = {
    id: string;
    label: string;
    description?: string;
};
export declare function getModifierDetailOptions(schema: ModifierDetailSchema): ModifierDetailOption[];
export declare function getModifierDetailSchemas(data: ModifierData): ModifierDetailSchema[];
export declare function formatModifierDetailSummary(data: ModifierData): string;
//# sourceMappingURL=modifier-details.d.ts.map