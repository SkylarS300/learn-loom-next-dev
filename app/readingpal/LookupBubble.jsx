"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./readingpal.module.css";

/**
 * Renders a tiny "Lookup" bubble near selection and a definition card on demand.
 * Non-conflicting: double-click remains available for your Note modal.
 */
export default function LookupBubble({ targetId = "reading-text" }) {
    const [sel, setSel] = useState(null); // { text, rect }
    const [card, setCard] = useState(null); // { word, data }
    const pressTimer = useRef(null);
    const bubbleRef = useRef(null);

    // Utility: get selection and bounding rect relative to viewport
    function getSelectionRect() {
        if (typeof window === "undefined") return null;
        const s = window.getSelection?.();
        if (!s || s.rangeCount === 0) return null;
        const text = String(s.toString() || "").trim();
        if (!text) return null;

        // Only allow a single word (letters / hyphens / apostrophes)
        const m = text.match(/^[A-Za-z][A-Za-z'-]*$/);
        if (!m) return null;

        const r = s.getRangeAt(0).cloneRange();
        const rect = r.getBoundingClientRect?.();
        if (!rect || !Number.isFinite(rect.top)) return null;
        return { text: m[0], rect };
    }

    // Position the bubble below selection
    function bubbleStyle(rect) {
        const top = window.scrollY + rect.bottom + 6;
        const left = window.scrollX + rect.left + rect.width / 2;
        return { top: `${top}px`, left: `${left}px`, transform: "translateX(-50%)" };
    }

    // Selection change listener
    useEffect(() => {
        function onChange() {
            const hit = getSelectionRect();
            setSel(hit);
        }
        document.addEventListener("selectionchange", onChange);
        return () => document.removeEventListener("selectionchange", onChange);
    }, []);

    // Only react to selections inside target container
    useEffect(() => {
        if (!sel) return;
        const target = document.getElementById(targetId);
        if (!target) return;
        const s = window.getSelection?.();
        if (!s || s.rangeCount === 0) return;

        const anchor = s.anchorNode;
        if (!anchor) { setSel(null); return; }

        const within = target.contains(anchor.nodeType === 3 ? anchor.parentNode : anchor);
        if (!within) setSel(null);
    }, [sel, targetId]);

    // Long-press: makes mobile discoverable (600–700ms)
    useEffect(() => {
        const target = document.getElementById(targetId);
        if (!target) return;

        const start = (e) => {
            if (pressTimer.current) clearTimeout(pressTimer.current);
            pressTimer.current = setTimeout(() => {
                const hit = getSelectionRect();
                if (hit) setSel(hit);
            }, 650);
        };
        const cancel = () => {
            if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
        };

        target.addEventListener("touchstart", start, { passive: true });
        target.addEventListener("touchend", cancel, { passive: true });
        target.addEventListener("touchmove", cancel, { passive: true });

        return () => {
            target.removeEventListener("touchstart", start);
            target.removeEventListener("touchend", cancel);
            target.removeEventListener("touchmove", cancel);
        };
    }, [targetId]);

    async function doLookup(word) {
        try {
            const r = await fetch(`/api/define?term=${encodeURIComponent(word)}`, { cache: "no-store" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Lookup failed");
            // Support both response shapes (current top-level vs. legacy {data:{...}})
            const data = j.data ?? {
                defs: j.defs || [],
                example: j.example || "",
                phonetic: j.phonetic || "",
            };
            setCard({ word, data });
            // Save to local recent words (for dashboard)
            try {
                const key = "myWordsV1";
                const prev = JSON.parse(localStorage.getItem(key) || "[]");
                const now = Date.now();
                const next = [{ word, when: now, defs: data.defs?.slice?.(0, 2) || [] },
                ...prev.filter(w => w.word !== word)].slice(0, 50);
                localStorage.setItem(key, JSON.stringify(next));
            } catch { }
        } catch (e) {
            setCard({ word, data: { defs: [], error: e.message } });
        } finally {
            setSel(null);
        }
    }

    function speak(text) {
        try {
            if (!("speechSynthesis" in window)) return;
            const u = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(u);
        } catch { }
    }

    return (
        <>
            {sel && (
                <div
                    ref={bubbleRef}
                    className={styles.lookupBubble}
                    style={bubbleStyle(sel.rect)}
                    role="dialog"
                    aria-label={`Lookup ${sel.text}`}
                >
                    <button
                        className={styles.lookupBtn}
                        onClick={() => doLookup(sel.text)}
                        title={`Lookup “${sel.text}”`}
                    >
                        Lookup “{sel.text}”
                    </button>
                </div>
            )}

            {card && (
                <div className={styles.lookupCard} role="dialog" aria-live="polite">
                    <div className={styles.lookupHeader}>
                        <strong>{card.word}</strong>
                        {card.data?.phonetic && <span className={styles.dim}> · {card.data.phonetic}</span>}
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                            <button className={styles.secondaryBtn} onClick={() => speak(card.word)} title="Speak">
                                Speak
                            </button>
                            <button className={styles.secondaryBtn} onClick={() => setCard(null)} title="Close">
                                Close
                            </button>
                        </div>
                    </div>

                    {card.data?.defs?.length ? (
                        <ul className={styles.lookupList}>
                            {card.data.defs.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                    ) : (
                        <p className={styles.dim} style={{ margin: 0 }}>No definition found.</p>
                    )}

                    {card.data?.example && (
                        <p className={styles.dim} style={{ marginTop: 6 }}>
                            e.g., “{card.data.example}”
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
