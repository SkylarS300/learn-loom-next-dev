"use client";

import { useEffect } from "react";

// Reads saved accessibility/display preferences and applies them to <html> as a
// data-theme attribute + CSS custom properties, so globals.css can style against
// them site-wide (see the "Preferences" section of globals.css).
export default function PreferenceApplier() {
    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/preferences", { cache: "no-store" });
                const j = await r.json();
                if (!dead && j?.ok) applyPreferences(j.data);
            } catch {
                // Non-fatal — page just renders with default styling.
            }
        })();
        return () => { dead = true; };
    }, []);

    return null;
}

// Exported so the settings page can apply changes immediately (optimistic UI)
// without waiting for a refetch.
export function applyPreferences(prefs) {
    if (typeof document === "undefined" || !prefs) return;
    const root = document.documentElement;
    root.dataset.theme = (prefs.theme || "LIGHT").toLowerCase().replace("_", "-");
    root.dataset.dyslexiaFont = prefs.dyslexiaFont ? "1" : "0";
    root.style.setProperty("--ll-font-scale", String((Number(prefs.fontScale) || 100) / 100));
    root.style.setProperty("--ll-highlight-color", prefs.highlightColor || "yellow");
}
