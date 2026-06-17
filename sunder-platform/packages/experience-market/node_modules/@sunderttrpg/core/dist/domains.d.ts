export type DomainId = "spark" | "root" | "flow" | "gleam" | "scorch" | "glare" | "still" | "crossing" | "warp" | "tear" | "thread" | "remnant" | "bastion";
export type DomainData = {
    id: DomainId;
    label: string;
    deity?: string;
    summary: string;
};
export declare const DOMAINS: DomainData[];
export declare function getDomainById(id: DomainId): DomainData | undefined;
//# sourceMappingURL=domains.d.ts.map