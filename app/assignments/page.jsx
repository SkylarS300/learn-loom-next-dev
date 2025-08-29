//app/assignments/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "../Navbar";
import styles from "../dashboard/Dashboard.module.css";

const TABS = ["ALL", "MISSING"];

export default function StudentAssignmentsIndex() {
    const [items, setItems] = useState([]);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("ALL");
    const [q, setQ] = useState("");

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/my/assignments?days=60", { cache: "no-store" });
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

    const view = useMemo(() => {
        const qlc = q.trim().toLowerCase();
        let rows = items.slice();
        if (tab === "MISSING") rows = rows.filter(x => x.bucket === "MISSING");
        if (qlc) rows = rows.filter(x =>
            (x.title || "").toLowerCase().includes(qlc) ||
            (x.classroomName || "").toLowerCase().includes(qlc)
        );
        // Default sort: soonest due first, then missing by most overdue
        rows.sort((a, b) => (dateNum(a.dueDate) - dateNum(b.dueDate)));
        return rows;
    }, [items, tab, q]);

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <Link href="/dashboard" className={styles.btnSecondary}>← Back</Link>
                <h1 style={{ marginTop: 8, marginBottom: 8 }}>My assignments</h1>

                {/* Controls */}
                <div className={styles.card} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div role="tablist" aria-label="Assignment filter" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {TABS.map(t => (
                                <button
                                    key={t}
                                    role="tab"
                                    aria-selected={tab === t}
                                    className={tab === t ? styles.btn : styles.btnSecondary}
                                    onClick={() => setTab(t)}
                                >
                                    {t === "ALL" ? "All" : "Missing"}
                                </button>
                            ))}
                        </div>
                        <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                        <input
                            className={styles.input}
                            placeholder="Search title or class"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            style={{ minWidth: 240 }}
                        />
                    </div>
                </div>

                {loading && <p className={styles.dim}>Loading…</p>}
                {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}

                {!loading && !err && (
                    <div className={styles.card} style={{ padding: 0 }}>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                <thead>
                                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                        <th style={th}>Title</th>
                                        <th style={th}>Class</th>
                                        <th style={th}>Type</th>
                                        <th style={th}>Status</th>
                                        <th style={th}>Score</th>
                                        <th style={th}>Due</th>
                                        <th style={th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {view.map(a => (
                                        <tr key={a.assignmentId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                            <td style={td}><strong>{a.title}</strong></td>
                                            <td style={td}>{a.classroomName}</td>
                                            <td style={td}><Chip>{typeLabel(a.type)}</Chip></td>
                                            <td style={td}>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    <Chip tone={toneOfStatus(a.status)}>{labelOfStatus(a.status)}</Chip>
                                                    {a.isLate && <Chip tone="warn">Late</Chip>}
                                                </div>
                                            </td>
                                            <td style={td}>{a.scorePct !== "" && a.scorePct != null ? `${a.scorePct}%` : "—"}</td>
                                            <td style={td}>{a.dueDate ? fmtDateTime(a.dueDate) : "—"}</td>
                                            <td style={td}><a href={a.href} className={styles.btnSecondary}>Open</a></td>
                                        </tr>
                                    ))}
                                    {view.length === 0 && (
                                        <tr>
                                            <td style={td} colSpan={7} className={styles.dim}>
                                                {tab === "MISSING" ? "No missing assignments. 🎉" : "No assignments in this view."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

const th = { textAlign: "left", padding: "10px 12px", fontWeight: 600 };
const td = { padding: "10px 12px", verticalAlign: "top" };

function Chip({ children, tone }) {
    const stylesMap = {
        ok: { background: "#ecfdf5", color: "#065f46", border: "1px solid #d1fae5" },
        warn: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" },
        info: { background: "#eef2ff", color: "#3730a3", border: "1px solid #e5e7eb" },
        default: { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" },
    };
    const s = stylesMap[tone || "default"];
    return <span style={{ ...s, borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{children}</span>;
}
function typeLabel(t) { return t === "BOOK" ? "Book" : t === "QUIZ" ? "Quiz" : t === "UPLOAD" ? "Upload" : t; }
function labelOfStatus(s) {
    const m = { ASSIGNED: "Assigned", SUBMITTED: "Submitted", GRADED: "Graded", LATE: "Late", MISSING: "Missing" };
    return m[s] || s || "—";
}
function toneOfStatus(s) {
    if (s === "GRADED") return "ok";
    if (s === "LATE" || s === "MISSING") return "warn";
    return "info";
}
function fmtDateTime(iso) {
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
    } catch { return iso; }
}
function dateNum(iso) { return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY; }
