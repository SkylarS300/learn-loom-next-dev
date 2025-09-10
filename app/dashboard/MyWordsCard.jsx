"use client";

import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

export default function MyWordsCard() {
    const [items, setItems] = useState([]);
    const [dueCount, setDueCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            // 1) Try server-side recent vocab
            try {
                const r = await fetch("/api/vocab/recent", { cache: "no-store" });
                const j = await r.json();
                if (j?.ok && Array.isArray(j.data) && j.data.length) {
                    setItems(j.data.slice(0, 6));
                } else {
                    // 2) Fallback to local-only list
                    const raw = localStorage.getItem("myWordsV1");
                    const arr = JSON.parse(raw || "[]");
                    setItems(Array.isArray(arr) ? arr.slice(0, 6) : []);
                }
            } catch {
                // local fallback on any error
                try {
                    const raw = localStorage.getItem("myWordsV1");
                    const arr = JSON.parse(raw || "[]");
                    setItems(Array.isArray(arr) ? arr.slice(0, 6) : []);
                } catch { setItems([]); }
            }
            // fetch due count (non-blocking)
            try {
                const r2 = await fetch("/api/vocab/due", { cache: "no-store" });
                const j2 = await r2.json();
                if (j2?.ok && Array.isArray(j2.items)) setDueCount(j2.items.length);
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, []);

    if (loading) return null;
    if (!items.length) {
        return (
            <div className={styles.card}>
                <h4 className={styles.h4} style={{ marginTop: 0 }}>🗂️ My Words</h4>
                <p className={styles.dim} style={{ margin: 0 }}>No recent vocabulary yet.</p>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <h4 className={styles.h4} style={{ marginTop: 0 }}>🗂️ My Words</h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
                {items.map((w, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                        <strong>{w.word || w.display || w.lemma}</strong>
                        {w.pos ? <span className={styles.dim}> · {w.pos}</span> : null}
                        {w.lastSeenAt ? <span className={styles.dim}> · {new Date(w.lastSeenAt).toLocaleDateString()}</span> : null}
                    </li>
                ))}
            </ul>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                    className={styles.btnSecondary}
                    onClick={() => {
                        try { localStorage.removeItem("myWordsV1"); } catch { }
                        setItems(items.filter(it => it.lastSeenAt)); // keep server items
                    }}
                >
                    Clear local list
                </button>
                {dueCount > 0 && (
                    <button
                        className={styles.btn}
                        onClick={() => { window.location.href = "/vocab/review"; }}
                        title={`${dueCount} due`}
                    >
                        Practice ({dueCount} due)
                    </button>
                )}
            </div>
        </div>
    );
}
