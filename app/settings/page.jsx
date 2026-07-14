// app/settings/page.jsx (SERVER)
import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export const metadata = {
    title: "Accessibility & display settings — LearnLoom",
};

export default function SettingsPage() {
    return (
        <Suspense fallback={null}>
            <SettingsClient />
        </Suspense>
    );
}
