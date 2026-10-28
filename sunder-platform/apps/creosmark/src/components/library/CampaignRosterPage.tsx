import React, { useEffect, useMemo, useState } from 'react';
import type { CampaignRecord, CharacterSheetSummary } from "../../types/library.ts";
import CharacterSheetCard from "./CharacterSheetCard.tsx";
import styles from './CampaignRosterPage.module.css';
import {routes} from "../../lib/routing.ts";
import ClipboardButton from "../common/ClipboardButton.tsx";
import CampaignLoomPanel from "./CampaignLoomPanel.tsx";
import CampaignGmPanel from "./CampaignGmPanel.tsx";
import CampaignSettingsPanel from "./CampaignSettingsPanel.tsx";
import type {
    CampaignGmTools,
    CampaignLoomPatch,
    CampaignLoomState,
} from "../../lib/campaign-loom.ts";

type CampaignRosterPageProps = {
    campaign: CampaignRecord;
    ownedCharacters?: CharacterSheetSummary[];
    onAddCharacter?: (characterSheetId: string) => Promise<void>;
    addingCharacterId?: string | null;
    onDetachCharacter?: (characterSheetId: string) => Promise<void>;
    detachingCharacterId?: string | null;
    actionError?: string | null;
    loom?: CampaignLoomState | null;
    loomError?: string | null;
    onLoomChange?: (patch: CampaignLoomPatch) => Promise<void>;
    gmTools?: CampaignGmTools | null;
    gmToolsError?: string | null;
    onGmToolsChange?: (tools: CampaignGmTools) => Promise<void>;
};

export default function CampaignRosterPage({
    campaign,
    ownedCharacters = [],
    onAddCharacter,
    addingCharacterId = null,
    onDetachCharacter,
    detachingCharacterId = null,
    actionError = null,
    loom = null,
    loomError = null,
    onLoomChange,
    gmTools = null,
    gmToolsError = null,
    onGmToolsChange,
}: CampaignRosterPageProps) {
    const joinCode = campaign.joinCode?.trim().toUpperCase();
    const sheetCount = campaign.characterIds.length;
    const isGm = campaign.viewerRole === "gm";
    const [pickerOpen, setPickerOpen] = useState(false);
    const [detachTarget, setDetachTarget] = useState<CharacterSheetSummary | null>(null);
    const [activeTab, setActiveTab] = useState<"roster" | "loom" | "gm" | "settings">("roster");
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [selectedCharacterId, setSelectedCharacterId] = useState("");
    const linkedCharacterIds = useMemo(
        () => new Set(campaign.characterIds),
        [campaign.characterIds],
    );
    const ownedCharacterIds = useMemo(
        () => new Set(ownedCharacters.map((character) => character.id)),
        [ownedCharacters]
    );
    const availableCharacters = useMemo(
        () =>
            ownedCharacters.filter(
                (character) => !linkedCharacterIds.has(character.id),
            ),
        [ownedCharacters, linkedCharacterIds],
    );
    const selectedCharacter = useMemo(
        () =>
            availableCharacters.find(
                (character) => character.id === selectedCharacterId,
            ) ?? null,
        [availableCharacters, selectedCharacterId],
    );

    useEffect(() => {
        if (!pickerOpen) return;

        setSelectedCharacterId((current) => {
            if (availableCharacters.some((character) => character.id === current)) {
                return current;
            }

            return availableCharacters[0]?.id ?? "";
        });
    }, [availableCharacters, pickerOpen]);

    useEffect(() => {
        if (!pickerOpen) {
            setSelectorOpen(false);
        }
    }, [pickerOpen]);

    useEffect(() => {
        if ((activeTab === "gm" || activeTab === "settings") && !isGm) {
            setActiveTab("roster");
        }
    }, [activeTab, isGm]);

    async function handleAddCharacter(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedCharacterId || !onAddCharacter) return;

        try {
            await onAddCharacter(selectedCharacterId);
            setPickerOpen(false);
        } catch {
            // The loader owns the visible action error so the modal can stay focused.
        }
    }

    async function handleConfirmDetach() {
        if (!detachTarget || !onDetachCharacter) return;

        try {
            await onDetachCharacter(detachTarget.id);
            setDetachTarget(null);
        } catch {
            // The data loader owns the visible error message.
            // Keep the confirmation dialog open after failure.
        }
    }

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroTopline}>
                    <div>
                        <div className={styles.eyebrow}>Campaign</div>
                        <h1 className={styles.title}>{campaign.name}</h1>
                    </div>

                    <div className={styles.joinCodeBlock}>
                        <div>
                            <span>Join Code</span>
                            <strong>{joinCode ?? "Unavailable"}</strong>
                        </div>
                        <ClipboardButton value={joinCode} label="Copy Code" successLabel="Copied" />
                    </div>
                </div>

                <div className={styles.metaRow}>
                    {campaign.gmName ? <span>GM · {campaign.gmName}</span> : null}
                    <span>{sheetCount} character sheet(s)</span>
                    {campaign.updatedLabel ? <span>{campaign.updatedLabel}</span> : null}
                </div>

                {campaign.pitch ? <p className={styles.copy}>{campaign.pitch}</p> : null}
            </header>

            <nav className={styles.tabs} aria-label="Campaign sections">
                <button
                    type="button"
                    className={`${styles.tabButton} ${
                        activeTab === "roster" ? styles.tabButtonActive : ""
                    }`}
                    onClick={() => setActiveTab("roster")}
                >
                    <i className="fa-solid fa-users" aria-hidden="true" />
                    <span>Roster</span>
                </button>
                <button
                    type="button"
                    className={`${styles.tabButton} ${
                        activeTab === "loom" ? styles.tabButtonActive : ""
                    }`}
                    onClick={() => setActiveTab("loom")}
                >
                    <i className="fa-solid fa-sun" aria-hidden="true" />
                    <span>Loom</span>
                </button>
                {isGm ? (
                    <>
                        <button
                            type="button"
                            className={`${styles.tabButton} ${
                                activeTab === "gm" ? styles.tabButtonActive : ""
                            }`}
                            onClick={() => setActiveTab("gm")}
                        >
                            <i className="fa-solid fa-user-shield" aria-hidden="true" />
                            <span>GM</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabButton} ${
                                activeTab === "settings" ? styles.tabButtonActive : ""
                            }`}
                            onClick={() => setActiveTab("settings")}
                        >
                            <i className="fa-solid fa-gear" aria-hidden="true" />
                            <span>Settings</span>
                        </button>
                    </>
                ) : null}
            </nav>

            {activeTab === "roster" ? (
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div>
                        <div className={styles.sectionEyebrow}>Roster</div>
                        <h2>Character Sheets</h2>
                    </div>

                    {onAddCharacter ? (
                        <button
                            type="button"
                            className={styles.primaryAction}
                            onClick={() => setPickerOpen(true)}
                        >
                            <i className="fa-solid fa-user-plus" aria-hidden="true" />
                            <span>Add Character</span>
                        </button>
                    ) : null}
                </div>

                {actionError ? (
                    <div className={styles.inlineError}>Error: {actionError}</div>
                ) : null}

                <div className={styles.grid}>
                    {campaign.characters.map((character) => {
                        const isOwner = ownedCharacterIds.has(character.id);
                        const canDetach = isOwner || isGm;

                        return (
                            <CharacterSheetCard
                                character={character}
                                key={character.id}
                                showEdit={isGm}
                                onRequestDetach={
                                    canDetach && onDetachCharacter
                                        ? (entry) => setDetachTarget(entry)
                                        : undefined
                                }
                                detaching={detachingCharacterId === character.id}
                            />
                        );
                    })}
                </div>
            </section>
            ) : null}

            {activeTab === "loom" ? (
                loomError ? (
                    <div className={styles.state}>
                        Loom unavailable: {loomError}
                    </div>
                ) : loom && onLoomChange ? (
                    <CampaignLoomPanel loom={loom} onChange={onLoomChange} />
                ) : (
                    <div className={styles.state}>Loading Loom...</div>
                )
            ) : null}

            {activeTab === "gm" && isGm ? (
                gmToolsError ? (
                    <div className={styles.state}>
                        GM tools unavailable: {gmToolsError}
                    </div>
                ) : gmTools && onGmToolsChange ? (
                    <CampaignGmPanel
                        campaign={campaign}
                        gmTools={gmTools}
                        onChange={onGmToolsChange}
                    />
                ) : (
                    <div className={styles.state}>Loading GM tools...</div>
                )
            ) : null}

            {activeTab === "settings" && isGm ? (
                <CampaignSettingsPanel campaign={campaign} />
            ) : null}

            {detachTarget ? (
                <div
                    className={styles.modalOverlay}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !detachingCharacterId) {
                            setDetachTarget(null);
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Escape" && !detachingCharacterId) {
                            setDetachTarget(null);
                        }
                    }}
                >
                    <section
                        className={styles.modalPanel}
                        role={"dialog"}
                        aria-modal={"true"}
                        aria-labelledby={"detach-character-title"}
                        aria-describedby={"detach-character-description"}
                    >
                        <header className={styles.modalHeader}>
                            <div>
                                <div className={styles.eyebrow}>
                                    Campaign Roster
                                </div>
                                <h3 id={"detach-character-title"}>
                                    Remove the Campaign
                                </h3>
                            </div>

                            <button
                                type={"button"}
                                className={styles.iconButton}
                                onClick={() => setDetachTarget(null)}
                                disabled={Boolean(detachingCharacterId)}
                                aria-label={"Close removal confirmation"}
                            >
                                <i className={"fa-solid fa-xmark"} aria-hidden={"true"} />
                            </button>
                        </header>

                        <div className={styles.modalBody}>
                            <p id={"detach-character-description"}>
                                Remove <strong>{detachTarget.name}</strong> from{" "}
                                <strong>{campaign.name}</strong>?
                            </p>

                            <p>
                                The character sheet will not be deleted.
                                Its existing owner will retain access to it,
                                and it can be assigned to another campaign later.
                            </p>

                            {actionError ? (
                                <div className={styles.inlineError} role={"alert"}>
                                    {actionError}
                                </div>
                            ) : null}

                            <div className={styles.modalActions}>
                                <button
                                    type={"button"}
                                    className={styles.secondaryAction}
                                    onClick={() => setDetachTarget(null)}
                                    disabled={Boolean(detachingCharacterId)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type={"button"}
                                    className={styles.primaryAction}
                                    onClick={() => void handleConfirmDetach()}
                                    disabled={Boolean(detachingCharacterId)}
                                >
                                    {detachingCharacterId
                                        ? "Removing..."
                                        : "Remove from Campaign"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            ) : null}

            {pickerOpen ? (
                <div
                    className={styles.modalOverlay}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setPickerOpen(false);
                        }
                    }}
                >
                    <section
                        className={styles.modalPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-character-title"
                    >
                        <header className={styles.modalHeader}>
                            <div>
                                <div className={styles.eyebrow}>Campaign Roster</div>
                                <h3 id="add-character-title">Add Character</h3>
                            </div>

                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => setPickerOpen(false)}
                                aria-label="Close add character dialog"
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </header>

                        <form className={styles.modalBody} onSubmit={handleAddCharacter}>
                            {actionError ? (
                                <div className={styles.inlineError}>Error: {actionError}</div>
                            ) : null}

                            {availableCharacters.length > 0 ? (
                                <>
                                    <div className={styles.fieldLabel}>
                                        <span>Character Sheet</span>
                                        <div className={styles.characterSelector}>
                                            <button
                                                type="button"
                                                className={styles.selectorButton}
                                                onClick={() => setSelectorOpen((open) => !open)}
                                                aria-haspopup="listbox"
                                                aria-expanded={selectorOpen}
                                                aria-controls="add-character-options"
                                                disabled={Boolean(addingCharacterId)}
                                            >
                                                <span className={styles.selectorButtonText}>
                                                    <strong>
                                                        {selectedCharacter?.name ?? "Choose a character"}
                                                    </strong>
                                                    {selectedCharacter ? (
                                                        <small>
                                                            Level {selectedCharacter.level} ·{" "}
                                                            {selectedCharacter.origin || "No origin"}
                                                        </small>
                                                    ) : null}
                                                </span>
                                                <i
                                                    className={`fa-solid ${
                                                        selectorOpen
                                                            ? "fa-chevron-up"
                                                            : "fa-chevron-down"
                                                    }`}
                                                    aria-hidden="true"
                                                />
                                            </button>

                                            {selectorOpen ? (
                                                <div
                                                    className={styles.selectorMenu}
                                                    id="add-character-options"
                                                    role="listbox"
                                                    aria-label="Available character sheets"
                                                >
                                                    {availableCharacters.map((character) => (
                                                        <button
                                                            type="button"
                                                            key={character.id}
                                                            role="option"
                                                            aria-selected={
                                                                selectedCharacterId === character.id
                                                            }
                                                            className={`${styles.selectorOption} ${
                                                                selectedCharacterId === character.id
                                                                    ? styles.selectorOptionSelected
                                                                    : ""
                                                            }`}
                                                            onClick={() => {
                                                                setSelectedCharacterId(character.id);
                                                                setSelectorOpen(false);
                                                            }}
                                                        >
                                                            <strong>{character.name}</strong>
                                                            <span>{character.archetype}</span>
                                                            <small>
                                                                Level {character.level} ·{" "}
                                                                {character.origin || "No origin"} · Player{" "}
                                                                {character.playerName || "Unknown"}
                                                            </small>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div
                                        className={styles.characterPreviewList}
                                        aria-label="Selected character summary"
                                    >
                                        {selectedCharacter ? (
                                            <div
                                                className={`${styles.characterOption} ${styles.characterSummary}`}
                                            >
                                                <strong>{selectedCharacter.name}</strong>
                                                <span>{selectedCharacter.archetype}</span>
                                                <small>
                                                    {selectedCharacter.origin || "No origin"} · Player{" "}
                                                    {selectedCharacter.playerName || "Unknown"}
                                                </small>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className={styles.modalActions}>
                                        <button
                                            type="button"
                                            className={styles.secondaryAction}
                                            onClick={() => setPickerOpen(false)}
                                            disabled={Boolean(addingCharacterId)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className={styles.primaryAction}
                                            disabled={!selectedCharacterId || Boolean(addingCharacterId)}
                                        >
                                            {addingCharacterId ? "Adding..." : "Add to Campaign"}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.emptyPickerState}>
                                    <strong>No available characters</strong>
                                    <p>
                                        {ownedCharacters.length === 0
                                            ? "Create a character sheet before adding one to this campaign."
                                            : "Every character sheet you own is already in this campaign."}
                                    </p>
                                    <a className={styles.secondaryAction} href={routes.home()}>
                                        Go to Characters
                                    </a>
                                </div>
                            )}
                        </form>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
