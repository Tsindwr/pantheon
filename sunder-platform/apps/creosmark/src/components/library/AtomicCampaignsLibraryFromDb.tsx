import React, {
    useEffect,
    useRef,
    useState,
} from "react";
import type {
    CampaignRecord,
} from "../../types/library.ts";
import type {
    CampaignCreationAttempt,
} from "../../application/library/campaign-creation-attempt.ts";
import {
    supabaseCampaignCreationComposition
} from "../../infrastructure/library/supabase-campaign-creation-composition.ts";
import {
    supabaseLibraryCampaignService
} from "../../infrastructure";
import { routes } from "../../lib/routing.ts";
import CampaignCard from "./CampaignCard.tsx";
import CampaignCreateDialog from "./CampaignCreateDialog.tsx";
import type {
    CampaignCreationInput,
} from "../../application/library/campaign-creation-attempt.ts";
import styles from "./CampaignsLibraryFromDb.module.css";

type CreationWorkflow = Awaited<ReturnType<typeof supabaseCampaignCreationComposition.prepare>>;

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "The campaign operation failed.";
}

/**
 * Local development interface for the B21 atomic creation RPC.
 *
 * This component is never selected for a production build.
 * The existing CampaignsLibraryFromDb remains unchanged.
 */
export default function AtomicCampaignsLibraryFromDb() {
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [pending, setPending] = useState<CampaignCreationAttempt | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const workflowRef = useRef<CreationWorkflow | null>(null);
    const busyRef = useRef(false);

    useEffect(() => {
        let active = true;

        async function initialize() {
            try {
                const [workflow, rows] = await Promise.all([
                    supabaseCampaignCreationComposition.prepare({
                        storage: window.sessionStorage,
                        createRequestId: () => window.crypto.randomUUID(),
                    }),
                    supabaseLibraryCampaignService.listMyCampaigns(),
                ]);

                if (!active) return;

                const restoredAttempt = workflow.pending();

                workflowRef.current = workflow;
                setPending(restoredAttempt);
                setCampaigns(rows);
                setErrorText(null);
            } catch (error) {
                if (!active) return;

                workflowRef.current = null;
                setErrorText(errorMessage(error));
            } finally {
                if (active) setLoading(false);
            }
        }

        void initialize();

        return () => {
            active = false;
            workflowRef.current = null;
        };
    }, []);

    function formatJoinCode(value: string): string {
        return value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 12);
    }

    async function executeCreation(
        operation: (
            workflow: CreationWorkflow,
        ) => Promise<{ campaign: { id: string } }>,
    ) {
        const workflow = workflowRef.current;

        if (!workflow || busyRef.current) return;

        busyRef.current = true;
        setBusy(true);
        setErrorText(null);

        try {
            const outcome = await operation(workflow);

            // A successful database response must remain successful
            // even if clearing the local attempt was unsuccessful.
            window.location.assign(
                routes.campaignView(outcome.campaign.id),
            );
        } catch (error) {
            console.error(
                "Atomic campaign creation failed:",
                error,
            );

            // Preserve the original UUID and metadata so the
            // user may retry rather than creating a duplicate.
            try {
                setPending(workflow.pending());
            } catch (storageError) {
                setErrorText("Unable to read the pending campaign: " +
                    errorMessage(storageError));
                return;
            }

            setErrorText(errorMessage(error));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    function handleCreateCampaign() {
        if (busyRef.current) return;

        const workflow = workflowRef.current;
        if (!workflow) return;

        try {
            const existing = workflow.pending();

            if (existing) {
                setPending(existing);
                setErrorText(
                    "Resolve the pending campaign before " +
                    "starting another one.",
                );
                return;
            }
        } catch (error) {
            setErrorText(errorMessage(error));
            return;
        }

        setErrorText(null);
        setCreateDialogOpen(true);
    }

    function handleSubmitCreate(input: CampaignCreationInput) {
        if (busyRef.current) return;

        setCreateDialogOpen(false);

        void executeCreation((current) => current.create(input));
    }

    function handleRetry() {
        void executeCreation((workflow) => workflow.retry());
    }

    function handleAbandon() {
        if (busyRef.current) return;

        const workflow = workflowRef.current;
        if (!workflow) return;

        try {
            const current = workflow.pending();
            if (!current) {
                setPending(null);
                return;
            }

            const confirmed = window.confirm(
                `Abandon the pending creation of "${current.name}"?\n\n` +
                "The original request may already have succeeded. " +
                "Abandoning it and creating another campaign " +
                "could result in duplicates. Retry is safer " +
                "when the outcome is uncertain."
            );

            if (!confirmed) return;

            workflow.abandon(current.requestId);
            setPending(null);
            setErrorText(null);
        } catch (error) {
            setErrorText(errorMessage(error));
        }
    }

    async function handleJoinCampaign(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (busyRef.current || !joinCode.trim()) return;

        busyRef.current = true;
        setBusy(true);
        setErrorText(null);

        try {
            const campaign = await supabaseLibraryCampaignService.joinCampaignByCode(joinCode);

            setJoinCode("");
            window.location.assign(routes.campaignView(campaign.id));
        } catch (error) {
            console.error("Campaign join failed:", error);
            setErrorText(errorMessage(error));
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <main className={styles.state}>
                Loading campaigns...
            </main>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.actionsCard}>
                <div className={styles.eyebrow}>
                    Local Development
                </div>

                <h2>Campaigns</h2>

                <div className={styles.actionsRow}>
                    <button
                        type={"button"}
                        className={styles.primary}
                        onClick={handleCreateCampaign}
                        disabled={
                            busy ||
                            pending !== null ||
                            !workflowRef.current
                        }
                    >
                        New Campaign
                    </button>

                    <form
                        className={styles.joinForm}
                        onSubmit={handleJoinCampaign}
                    >
                        <input
                            value={joinCode}
                            onChange={(event) =>
                                setJoinCode(
                                    formatJoinCode(
                                        event.target.value,
                                    ),
                                )
                            }
                            placeholder={"Join code"}
                            aria-label={"Campaign join code"}
                            autoComplete={"off"}
                            spellCheck={false}
                            disabled={busy}
                        />

                        <button
                            type={"submit"}
                            className={styles.secondary}
                            disabled={busy}
                        >
                            Join Campaign
                        </button>
                    </form>
                </div>
            </section>

            {pending && (
                <section
                    className={styles.actionsCard}
                    aria-labelledby={"pending-campaign-title"}
                >
                    <div className={styles.eyebrow}>
                        Pending Creation
                    </div>

                    <h2 id={"pending-campaign-title"}>
                        {pending.name}
                    </h2>

                    <p>
                        The outcome of this creation request
                        has not been confirmed. Retrying uses
                        the original request ID and campaign
                        details, so a successfully committed
                        campaign will not be duplicated.
                    </p>

                    <div className={styles.actionsRow}>
                        <button
                            type={"button"}
                            className={styles.primary}
                            disabled={busy}
                            onClick={handleRetry}
                        >
                            {busy
                                ? "Checking..."
                                : "Retry Pending Creation"}
                        </button>

                        <button
                            type={"button"}
                            className={styles.secondary}
                            disabled={busy}
                            onClick={handleAbandon}
                        >
                            Abandon Pending Creation
                        </button>
                    </div>
                </section>
            )}

            {errorText && (
                <div className={styles.error} role={"alert"}>
                    Error: {errorText}
                </div>
            )}

            {campaigns.length > 0 ? (
                <section className={styles.grid}>
                    {campaigns.map((campaign) => (
                        <CampaignCard
                            key={campaign.id}
                            campaign={campaign}
                        />
                    ))}
                </section>
            ) : (
                <section className={styles.emptyState}>
                    <div className={styles.emptyEyebrow}>
                        No Campaigns Yet
                    </div>

                    <h2>Create or join a campaign</h2>

                    <p>
                        Your campaigns will appear here once
                        you create or join one.
                    </p>
                </section>
            )}

            <CampaignCreateDialog
                open={createDialogOpen}
                busy={busy}
                onDismiss={() => setCreateDialogOpen(false)}
                onCreate={handleSubmitCreate}
            />
        </div>
    );
}