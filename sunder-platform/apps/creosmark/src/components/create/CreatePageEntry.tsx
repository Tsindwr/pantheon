import AppShell from "../app/AppShell.tsx";
import { routes } from "../../lib/routing.ts";
import CreateWorkspace from "./CreateWorkspace";

export default function CreatePageEntry() {
    return (
        <AppShell activePath={routes.createHome()}>
            <CreateWorkspace />
        </AppShell>
    );
}
