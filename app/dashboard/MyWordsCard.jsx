"use client";

import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

/* Reusable modal matching your dashboard styles */
function Modal({ open, title, children, onClose }) {
    useEffect(() => {
        if (!open) return;
        function onKey(e) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button className={styles.modalCloseX} onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className={styles.modalBody}>{children}</div>
            </div>
        </div>
    );
}

export default function MyWordsCard() {
    const [tab, setTab] = useState("server"); // "server" | "device"
    const [deviceItems, setDeviceItems] = useState([]);
    const [serverItems, setServerItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [noteOpen, setNoteOpen] = useState(false);
    const [noteSeed, setNoteSeed] = useState({ studyId: null, word: "", note: "", example: "" });

    // Initial load: try server list, fallback to local
    useEffect(() => {
        let dead = false;

        (async () => {
            try {
                const r = await fetch("/api/vocab/list?take=20", { cache: "no-store" });
                if (r.ok) {
                    const j = await r.json();
                    if (!dead && j?.ok) {
                        setServerItems(j.items || []);
                        setLoading(false);
                        return;
                    }
                }
            } catch { /* fall back */ }

            // Fallback: device-local words
            try {
                const raw = localStorage.getItem("myWordsV1");
                const arr = JSON.parse(raw || "[]");
                if (!dead) setDeviceItems(Array.isArray(arr) ? arr.slice(0, 20) : []);
            } catch { if (!dead) setDeviceItems([]); }
            if (!dead) setLoading(false);
        })();

        return () => { dead = true; };
    }, []);

    // Actions
    async function del(studyId) {
        const row = serverItems.find(x => x.studyId === studyId);
        if (!row) return;
        if (!confirm(`Remove “${row.display || row.lemma}” from your study list?`)) return;
        try {
            const r = await fetch("/api/vocab/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studyId }),
            });
            if (r.ok) {
                setServerItems(xs => xs.filter(x => x.studyId !== studyId));
            }
        } catch { /* ignore */ }
    }

    function openNote(studyId) {
        const row = serverItems.find(x => x.studyId === studyId);
        if (!row) return;
        setNoteSeed({
            studyId,
            word: row.display || row.lemma,
            note: row.note || "",
            example: row.example || "",
        });
        setNoteOpen(true);
    }

    async function saveNote() {
        try {
            const wordId = serverItems.find(x => x.studyId === noteSeed.studyId)?.wordId;
            const r = await fetch("/api/vocab/note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wordId,
                    note: noteSeed.note,
                    example: noteSeed.example,
                }),
            });
            if (r.ok) {
                setServerItems(xs =>
                    xs.map(x =>
                        x.studyId === noteSeed.studyId ? { ...x, note: noteSeed.note, example: noteSeed.example } : x
                    )
                );
                setNoteOpen(false);
            }
        } catch { /* ignore */ }
    }

    const active = tab === "server" ? serverItems : deviceItems;

    // Empty device list view
    if (tab === "device" && !active.length) {
        return (
            <div className={styles.card}>
                <h4 className={styles.h4} style={{ marginTop: 0 }}>🗂️ My Words</h4>
                <div className={styles.tabBar}>
                    <button className={styles.tab} onClick={() => setTab("server")}>Saved</button>
                    <button className={styles.tabActive} onClick={() => setTab("device")}>This device</button>
                </div>
                <p className={styles.dim} style={{ marginTop: 8 }}>No local words yet.</p>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <h4 className={styles.h4} style={{ marginTop: 0 }}>🗂️ My Words</h4>

            <div className={styles.tabBar} style={{ marginBottom: 8 }}>
                <button
                    className={tab === "server" ? styles.tabActive : styles.tab}
                    onClick={() => setTab("server")}
                >
                    Saved <span className={styles.countPill}>{serverItems.length}</span>
                </button>
                <button
                    className={tab === "device" ? styles.tabActive : styles.tab}
                    onClick={() => setTab("device")}
                >
                    This device <span className={styles.countPill}>{deviceItems.length}</span>
                </button>
            </div>

            {tab === "server" ? (
                <>
                    {loading ? (
                        <div className={styles.dim}>Loading…</div>
                    ) : serverItems.length ? (
                        <ul className={styles.listReset}>
                            {serverItems.map((w) => (
                                <li key={w.studyId} className={styles.assignmentRow} style={{ marginTop: 8 }}>
                                    <div className={styles.assignmentMain}>
                                        <div className={styles.titleRow}>
                                            <span className={styles.assignmentTitle}>{w.display || w.lemma}</span>
                                            {((w.pos && w.pos !== "unknown") || (w.cefr && w.cefr !== "UNKNOWN")) && (
                                                <span className={styles.typeBadge}>
                                                    {w.pos && w.pos !== "unknown" ? w.pos : "—"} · {w.cefr && w.cefr !== "UNKNOWN" ? w.cefr : "—"}
                                                </span>
                                            )}
                                        </div>
                                        {w.note && (
                                            <div className={styles.dim} style={{ marginTop: 4 }}>
                                                {w.note}
                                            </div>
                                        )}
                                        {w.example && (
                                            <div className={styles.dim} style={{ marginTop: 2 }}>
                                                <em>“{w.example}”</em>
                                            </div>
                                        )}
                                        {w.stats?.nextDue && (
                                            <div className={styles.dim} style={{ marginTop: 4 }}>
                                                Due {new Date(w.stats.nextDue).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.assignmentActions}>
                                        <button className={styles.btnSecondary} onClick={() => openNote(w.studyId)}>✏️ Note</button>
                                        <button className={styles.btnDanger} onClick={() => del(w.studyId)}>Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.dim}>No saved words yet—add some from Reading Pal.</p>
                    )}
                </>
            ) : (
                <>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {deviceItems.map((w, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                                <strong>{w.word}</strong>
                                {w.defs?.length ? <span className={styles.dim}> — {w.defs[0]}</span> : null}
                            </li>
                        ))}
                    </ul>
                    <button
                        className={styles.btnSecondary}
                        style={{ marginTop: 8 }}
                        onClick={() => {
                            try { localStorage.removeItem("myWordsV1"); } catch { }
                            setDeviceItems([]);
                        }}
                    >
                        Clear list (local)
                    </button>
                </>
            )}

            <Modal
                open={noteOpen}
                title={`Note — ${noteSeed.word}`}
                onClose={() => setNoteOpen(false)}
            >
                <label style={{ display: "grid", gap: 6 }}>
                    <span>Personal note</span>
                    <textarea
                        rows={4}
                        value={noteSeed.note}
                        onChange={(e) => setNoteSeed(s => ({ ...s, note: e.target.value.slice(0, 2000) }))}
                        className={styles.textarea}
                        style={{ width: "100%" }}
                    />
                </label>
                <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    <span>Your example sentence</span>
                    <input
                        type="text"
                        value={noteSeed.example}
                        onChange={(e) => setNoteSeed(s => ({ ...s, example: e.target.value.slice(0, 500) }))}
                        className={styles.input}
                        style={{ width: "100%" }}
                    />
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                    <button className={styles.btnSecondary} onClick={() => setNoteOpen(false)}>Cancel</button>
                    <button className={styles.btn} onClick={saveNote}>Save</button>
                </div>
            </Modal>
        </div>
    );
}
