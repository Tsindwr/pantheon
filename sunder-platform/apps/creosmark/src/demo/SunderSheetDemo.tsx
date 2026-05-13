import React from "react";
import CharacterSheetShell from "../components/shell/CharacterSheetShell";
import { DEMO_SHEET } from "../lib/sheet-data";

export default function SunderSheetDemo() {
  return <CharacterSheetShell initialSheet={DEMO_SHEET} />;
}
