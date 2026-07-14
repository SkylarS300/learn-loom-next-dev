"use client";

import { useEffect, useState } from "react";
import { applyPreferences } from "../components/PreferenceApplier";
import styles from "./settings.module.css";

const DEFAULTS = { fontScale: 100, theme: "LIGHT", dyslexiaFont: false, highlightColor: "yellow" };

const HIGHLIGHT_COLORS = [
    { value: "yellow", label: "Yellow" },
    { value: "lightgreen", label: "Green" },
    { value: "lightblue", label: "Blue" },
    { value: "pink", label: "Pink" },
    { value: "orange", label: "Orange" },
    { value: "khaki", label: "Khaki" },
];

export default function SettingsClient() {
    const [prefs, setPrefs] = useState(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/preferences", { cache: "no-store" });
                const j = await r.json();
                if (!dead && j?.ok) setPrefs({ ...DEFAULTS, ...j.data });
            } catch {
                if (!dead) setErr("Couldn't load your saved settings — showing defaults.");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, []);

    function update(patch) {
        const next = { ...prefs, ...patch };
        setPrefs(next);
        applyPreferences(next); // live preview, before saving
    }

    async function save() {
        setSaving(true);
        setErr("");
        try {
            const r = await fetch("/api/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(prefs),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Save failed");
            setSavedAt(Date.now());
        } catch (e) {
            setErr(e.message || "Couldn't save your settings. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className={styles.wrap}>
                <h1>Accessibility &amp; display</h1>
                <p aria-live="polite">Loading your settings…</p>
            </main>
        );
    }

    return (
        <main className={styles.wrap}>
            <h1>Accessibility &amp; display</h1>
            <p className={styles.intro}>
                These apply across LearnLoom and are saved to your code, so they follow you to any device
                you log in on.
            </p>

            {err && <div role="alert" className={styles.error}>{err}</div>}

            <section className={styles.section} aria-labelledby="font-scale-heading">
                <h2 id="font-scale-heading">Text size</h2>
                <label htmlFor="font-scale" className={styles.label}>
                    {prefs.fontScale}%
                </label>
                <input
                    id="font-scale"
                    type="range"
                    min={80}
                    max={200}
                    step={10}
                    value={prefs.fontScale}
                    onChange={(e) => update({ fontScale: Number(e.target.value) })}
                    aria-describedby="font-scale-heading"
                    className={styles.range}
                />
            </section>

            <section className={styles.section} aria-labelledby="theme-heading">
                <h2 id="theme-heading">Color theme</h2>
                <div role="radiogroup" aria-labelledby="theme-heading" className={styles.options}>
                    {[
                        { value: "LIGHT", label: "Light (default)" },
                        { value: "DARK", label: "Dark" },
                        { value: "HIGH_CONTRAST", label: "High contrast" },
                    ].map((opt) => (
                        <label key={opt.value} className={styles.radioRow}>
                            <input
                                type="radio"
                                name="theme"
                                value={opt.value}
                                checked={prefs.theme === opt.value}
                                onChange={() => update({ theme: opt.value })}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </section>

            <section className={styles.section} aria-labelledby="dyslexia-heading">
                <h2 id="dyslexia-heading">Reading font</h2>
                <label className={styles.radioRow}>
                    <input
                        type="checkbox"
                        checked={prefs.dyslexiaFont}
                        onChange={(e) => update({ dyslexiaFont: e.target.checked })}
                    />
                    Use a more spaced-out, dyslexia-friendly font
                </label>
                <p className={styles.hint}>
                    Switches body text to a wider, more evenly-spaced font. Not a specialized dyslexia
                    typeface — just a lower-friction adjustment some readers find easier.
                </p>
            </section>

            <section className={styles.section} aria-labelledby="highlight-heading">
                <h2 id="highlight-heading">Reading Pal highlight color</h2>
                <div role="radiogroup" aria-labelledby="highlight-heading" className={styles.swatches}>
                    {HIGHLIGHT_COLORS.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            aria-pressed={prefs.highlightColor === c.value}
                            aria-label={c.label}
                            onClick={() => update({ highlightColor: c.value })}
                            style={{ background: c.value }}
                            className={
                                prefs.highlightColor === c.value
                                    ? `${styles.swatch} ${styles.swatchActive}`
                                    : styles.swatch
                            }
                        />
                    ))}
                </div>
                <p className={styles.hint}>
                    Sets the default for new Reading Pal sessions. If you&apos;ve already picked a color
                    inside a specific book, that book keeps its own choice.
                </p>
            </section>

            <div className={styles.actions}>
                <button onClick={save} disabled={saving} className={styles.saveBtn}>
                    {saving ? "Saving…" : "Save settings"}
                </button>
                {savedAt && <span aria-live="polite" className={styles.savedNote}>Saved</span>}
            </div>
        </main>
    );
}
