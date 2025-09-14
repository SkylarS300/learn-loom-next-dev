"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";

function Modal({ open, title, children, onClose }) {
    if (!open) return null;
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
            display: "grid", placeItems: "center", zIndex: 120
        }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "min(560px,92vw)", background: "#fff", border: "1px solid #e5e7eb",
                    borderRadius: 12, padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,.15)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                    <h4 style={{ margin: 0 }}>{title}</h4>
                    <button className={styles.btnSecondary} onClick={onClose}>Close</button>
                </div>
                <div style={{ marginTop: 8 }}>{children}</div>
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
    const [noteSeed, setNoteSeed] = useState({ studyId: null, word: "", current: "", example: "" });

    useEffect(() => {
        // device list
        try {
            const raw = localStorage.getItem("myWordsV1");
            const arr = JSON.parse(raw || "[]");
            setDeviceItems(Array.isArray(arr) ? arr.slice(0, 50) : []);
        } catch { setDeviceItems([]); }

        // server list
        (async () => {
            try {
                setLoading(true);
                const r = await fetch("/api/vocab/list?take=20", { cache: "no-store" });
                const j = await r.json();
                if (j?.ok) setServerItems(j.items || []);
            } catch { /* no-op */ }
            finally { setLoading(false); }
        })();
    }, []);

    async function del(studyId) {
        const row = serverItems.find(x => x.studyId === studyId);
        if (!row) return;
        if (!confirm(`Remove "${row.display || row.lemma}" from your study list?`)) return;
        try {
            await fetch("/api/vocab/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wordId: row.wordId }),
            });
            setServerItems((xs) => xs.filter(x => x.studyId !== studyId));
        } catch { /* ignore */ }
    }

    async function review(studyId, rating) {
        try {
            await fetch("/api/vocab/review", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: studyId, rating }),
            });
            // optimistic: move the item to the end
            setServerItems((xs) => {
                const idx = xs.findIndex(x => x.studyId === studyId);
                if (idx < 0) return xs;
                const copy = xs.slice();
                const [it] = copy.splice(idx, 1);
                copy.push(it);
                return copy;
            });
        } catch { /* no-op */ }
    }

    function openNote(studyId) {
        const row = serverItems.find(x => x.studyId === studyId);
        if (!row) return;
        setNoteSeed({
            studyId,
            word: row.display || row.lemma,
            current: row.note || "",
            example: row.example || "",
        });
        setNoteOpen(true);
    }

    async function saveNote() {
        try {
            await fetch("/api/vocab/note", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wordId: serverItems.find(x => x.studyId === noteSeed.studyId)?.wordId,
                    note: noteSeed.current,
                    example: noteSeed.example,
                }),
            });
            setServerItems((xs) => xs.map(x => x.studyId === noteSeed.studyId
                ? { ...x, note: noteSeed.current, example: noteSeed.example }
                : x));
            setNoteOpen(false);
        } catch { /* no-op */ }
    }

    const active = tab === "server" ? serverItems : deviceItems;

    if (!active.length && tab === "device") {
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
                                            <span className={styles.typeBadge}>{w.pos || "—"} · {w.cefr}</span>
                                        </div>
                                        {w.note && <div className={styles.dim} style={{ marginTop: 4 }}>{w.note}</div>}
                                        {w.example && <div className={styles.dim} style={{ marginTop: 2 }}><em>“{w.example}”</em></div>}
                                    </div>
                                    <div className={styles.assignmentActions}>
                                        <button className={styles.btnSecondary} onClick={() => openNote(w.studyId)}>✏️ Note</button>
                                        <button className={styles.btnSecondary} onClick={() => review(w.studyId, "good")}>Good</button>
                                        <button className={styles.btnSecondary} onClick={() => review(w.studyId, "easy")}>Easy</button>
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
                        value={noteSeed.current}
                        onChange={(e) => setNoteSeed(s => ({ ...s, current: e.target.value.slice(0, 2000) }))}
                        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}
                    />
                </label>
                <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    <span>Your example sentence</span>
                    <input
                        type="text"
                        value={noteSeed.example}
                        onChange={(e) => setNoteSeed(s => ({ ...s, example: e.target.value.slice(0, 500) }))}
                        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}
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
