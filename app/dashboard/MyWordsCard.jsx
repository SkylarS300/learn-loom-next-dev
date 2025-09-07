"use client";

import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

export default function MyWordsCard() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("myWordsV1");
            const arr = JSON.parse(raw || "[]");
            setItems(Array.isArray(arr) ? arr.slice(0, 6) : []);
        } catch { setItems([]); }
    }, []);

    if (!items.length) return null;

    return (
        <div className={styles.card}>
            <h4 className={styles.h4} style={{ marginTop: 0 }}>🗂️ My Words (device)</h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
                {items.map((w, i) => (
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
                    setItems([]);
                }}
            >
                Clear list (local)
            </button>
        </div>
    );
}
