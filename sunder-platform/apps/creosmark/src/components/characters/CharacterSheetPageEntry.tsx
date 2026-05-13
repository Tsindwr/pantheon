import React from "react";
import AuthGate from "../auth/AuthGate";
import SignInScreen from "../auth/SignInScreen";
import CharacterSheetFromDb from "./CharacterSheetFromDb";

type CharacterSheetPageEntryProps = {
    characterId: string;
    initialMode?: "play" | "edit";
};

export default function CharacterSheetPageEntry({
    characterId,
    initialMode = "play",
}: CharacterSheetPageEntryProps) {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <CharacterSheetFromDb characterId={characterId} initialMode={initialMode} />
        </AuthGate>
    );
}