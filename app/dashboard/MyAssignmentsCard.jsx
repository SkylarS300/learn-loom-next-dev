"use client";

import Link from "next/link";
import styles from "./Dashboard.module.css";
import { useEffect, useState, useMemo } from "react";

export default function MyAssignmentsCard() {
    const [items, setItems] = useState([]);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/my/assignments?days=30", { cache: "no-store" });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load");
                if (!dead) setItems(j.data || []);
            } catch (e) {
                if (!dead) setErr(e.message || "Failed to load");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, []);

    // Hide entirely for teacher-only accounts (API returns [])+  if (!loading && !err && items.length === 0) return null;
    if (!loading && !err && items.length === 0) return null;

    const dueSoon = useMemo(() => items.filter(i => i.bucket === "DUE_SOON"), [items]);
    const missing = useMemo(() => items.filter(i => i.bucket === "MISSING"), [items]);

    return (
        <section className={styles.card}>
            <div className={styles.headerRow}>
                <h3 className={styles.h3} style={{ margin: 0 }}>📚 My assignments</h3>
                <div className={styles.growRight}>
                    <Link className={styles.btnSecondary} href="/assignments">View all</Link>
                </div>
            </div>

            {loading && <p className={styles.dim}>Loading…</p>}
            {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}

            {!loading && !err && (
                <>
                    <ListBlock title="Due soon" items={dueSoon} empty="Nothing due soon." />
                    <div style={{ height: 10 }} />
                    <ListBlock title="Missing" items={missing} empty="No missing work. 🎉" />
                </>
            )}
        </section>
    );
}

function ListBlock({ title, items, empty }) {
    return (
        <div>
            <h4 className={styles.h4} style={{ marginTop: 0, marginBottom: 6 }}>{title}</h4>
            {items.length === 0 ? (
                <p className={styles.dim} style={{ margin: 0 }}>{empty}</p>
            ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                    {items.map(a => (
                        <li key={a.assignmentId} className={styles.listRow}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                                <div>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <strong>{a.title}</strong>
                                        <Chip>{typeLabel(a.type)}</Chip>
                                        {a.isLate && <Chip tone="warn">Late</Chip>}
                                        {a.scorePct !== "" && a.scorePct != null && <Chip tone="ok">{a.scorePct}%</Chip>}
                                    </div>
                                    <div className={styles.dim} style={{ marginTop: 2 }}>
                                        {a.classroomName} {a.dueDate ? `· Due ${fmtDateTime(a.dueDate)}` : "· No due date"}
                                    </div>
                                </div>
                                <a href={a.href} className={styles.btnSecondary}>Open</a>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function Chip({ children, tone }) {
    const stylesMap = {
        ok: { background: "#ecfdf5", color: "#065f46", border: "1px solid #d1fae5" },
        warn: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" },
        default: { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" },
    };
    const s = stylesMap[tone || "default"];
    return <span style={{ ...s, borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{children}</span>;
}

function typeLabel(t) {
    if (t === "BOOK") return "Book";
    if (t === "QUIZ") return "Quiz";
    if (t === "UPLOAD") return "Upload";
    return t || "—";
}
function fmtDateTime(iso) {
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
    } catch {
        return iso;
    }
}