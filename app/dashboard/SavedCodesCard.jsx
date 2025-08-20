"use client";
import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

export default function SavedCodesCard() {
    const [codes, setCodes] = useState([]);
    const [val, setVal] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/sharecode", { cache: "no-store" });
                const j = await r.json();
                if (!dead) {
                    if (j?.ok) setCodes(Array.isArray(j.data) ? j.data : []);
                    else setErr(j?.error || "Failed to load codes");
                }
            } catch {
                if (!dead) setErr("Failed to load codes");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, []);

    async function add(e) {
        e?.preventDefault();
        const code = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!code) return;
        try {
            const r = await fetch("/api/sharecode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const j = await r.json();
            if (j?.ok) {
                setCodes(Array.isArray(j.data) ? j.data : []);
                setVal("");
            } else {
                alert(j?.error || "Could not save code");
            }
        } catch {
            alert("Could not save code");
        }
    }

    async function remove(code) {
        try {
            const r = await fetch(`/api/sharecode?code=${encodeURIComponent(code)}`, { method: "DELETE" });
            const j = await r.json();
            if (j?.ok) setCodes(Array.isArray(j.data) ? j.data : []);
        } catch { /* noop */ }
    }

    return (
        <div className={styles.card}>
            <h3 style={{ marginTop: 0 }}>🔖 Saved share codes</h3>
            <p className={styles.dim} style={{ marginTop: 4 }}>
                Codes you’ve saved for shared uploads or classrooms.
            </p>

            <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                    className={styles.search}
                    placeholder="Add code (e.g., ABC234)"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    aria-label="Add share code"
                />
                <button className={styles.btn} disabled={!val.trim()}>Save</button>
            </form>

            {loading ? (
                <p className={styles.dim} style={{ marginTop: 8 }}>Loading…</p>
            ) : err ? (
                <p style={{ color: "#b91c1c", marginTop: 8 }}>{err}</p>
            ) : codes.length === 0 ? (
                <p className={styles.dim} style={{ marginTop: 8 }}>No saved codes yet.</p>
            ) : (
                <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                    {codes.map((c) => (
                        <li key={c} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <code style={{ fontWeight: 700 }}>{c}</code>
                            <button className={styles.btnSecondary} onClick={() => remove(c)}>Remove</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
