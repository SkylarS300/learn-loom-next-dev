// app/assignments/[aid]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Navbar from "../../Navbar";
import styles from "../../dashboard/Dashboard.module.css";

export default function AssignmentDetailPage() {
    const { aid } = useParams();
    const id = Number(aid);
    const qs = useSearchParams();
    const demo = qs.get("demo") === "1";

    const [data, setData] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let dead = false;
        const ctl = new AbortController();
        (async () => {
            try {
                if (demo) {
                    if (!dead) {
                        setData(demoPayload());
                    }
                    return;
                }
                const r = await fetch(`/api/assignments/${id}`, { cache: "no-store", signal: ctl.signal });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load");
                if (!dead) setData(j.data);
            } catch (e) {
                if (!dead) setErr(e.message || "Failed to load");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; ctl.abort(); };
    }, [id, demo]);

    const a = data?.assignment;
    const rows = data?.students || [];

    const dueISO = a?.dueDate;
    const startISO = a?.startAt;
    const exportHref = a ? `/api/assignments/${a.id}/export` : "#";

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <a href="/dashboard" className={styles.btnSecondary}>← Back</a>

                <h1 style={{ marginTop: 8, marginBottom: 6 }}>{a ? a.title : "Assignment"}</h1>
                {a && (
                    <p className={styles.dim} style={{ marginTop: 0 }}>
                        {badge(a.type)} {startISO ? <> · Starts: {fmtDateTime(startISO)}</> : null}
                        {dueISO ? <> · Due: {fmtDateTime(dueISO)}</> : null}
                        {" · "}Allow late: {a.allowLate ? "Yes" : "No"}
                        {a.latePenaltyPct != null ? ` (${a.latePenaltyPct}% penalty)` : ""}
                        {a.weightPoints != null ? ` · Weight: ${a.weightPoints} pts` : ""}
                    </p>
                )}

                <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
                    <a href={exportHref} className={styles.btn}>Export CSV</a>
                </div>

                {demo && (
                    <p className={styles.dim} style={{ marginTop: 4 }}>
                        Demo mode (<code>?demo=1</code>)
                    </p>
                )}

                {loading && <p className={styles.dim}>Loading…</p>}
                {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}

                {!loading && !err && (
                    <div className={styles.card} style={{ padding: 0 }}>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                <thead>
                                    <tr style={trHead}>
                                        <th style={th}>Student</th>
                                        <th style={th}>Anon ID</th>
                                        <th style={th}>Status</th>
                                        <th style={th}>Attempts</th>
                                        <th style={th}>Score</th>
                                        <th style={th}>Submitted</th>
                                        <th style={th}>Graded</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.anonId} style={trBody}>
                                            <td style={td}><strong>{r.displayName || r.anonId?.slice(0, 8) + "…"}</strong></td>
                                            <td style={td}><code>{r.anonId}</code></td>
                                            <td style={td}>{statusChip(r.status)}</td>
                                            <td style={td}>{r.attemptCount ?? 0}</td>
                                            <td style={td}>{r.scorePct !== "" && r.scorePct != null ? `${r.scorePct}%` : "—"}</td>
                                            <td style={td}>{fmtMaybe(r.submittedAt)}</td>
                                            <td style={td}>{fmtMaybe(r.gradedAt)}</td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr><td style={td} colSpan={7} className={styles.dim}>No targeted students yet.</td></tr>
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

const trHead = { background: "#f9fafb", borderBottom: "1px solid #e5e7eb" };
const trBody = { borderBottom: "1px solid #f3f4f6" };
const th = { textAlign: "left", padding: "10px 12px", fontWeight: 600 };
const td = { padding: "10px 12px", verticalAlign: "top" };

function badge(t) {
    return <span style={{
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12
    }}>{t === "BOOK" ? "Book" : t === "QUIZ" ? "Quiz" : t === "UPLOAD" ? "Upload" : t}</span>;
}

function statusChip(s) {
    const map = {
        ASSIGNED: { bg: "#eef2ff", color: "#3730a3", label: "Assigned" },
        SUBMITTED: { bg: "#ecfeff", color: "#155e75", label: "Submitted" },
        GRADED: { bg: "#ecfdf5", color: "#065f46", label: "Graded" },
        LATE: { bg: "#fff7ed", color: "#9a3412", label: "Late" },
        MISSING: { bg: "#fef2f2", color: "#991b1b", label: "Missing" },
    };
    const v = map[s] || { bg: "#f3f4f6", color: "#374151", label: s || "—" };
    return <span style={{
        background: v.bg, color: v.color, borderRadius: 999, padding: "2px 8px", fontSize: 12
    }}>{v.label}</span>;
}

function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? iso : new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
    }).format(d);
}
function fmtMaybe(v) {
    if (!v) return "—";
    const iso = typeof v === "string" ? v : v?.toString?.();
    return fmtDateTime(iso);
}

// Demo payload mirrors /api/assignments/:aid shape
function demoPayload() {
    const now = new Date();
    const start = new Date(now.getTime() - 2 * 86400000);
    const due = new Date(now.getTime() + 2 * 86400000);
    return {
        assignment: {
            id: 999,
            classroomId: 1,
            title: "Verb Tenses — Quiz A",
            description: "Practice past tense",
            type: "QUIZ",
            startAt: start.toISOString(),
            dueDate: due.toISOString(),
            allowLate: true,
            latePenaltyPct: 10,
            weightPoints: 20,
            category: "verbs",
            subtopic: "past",
            bookId: null, chapterIndex: null, uploadId: null,
            targets: [{ anonId: null }],
            createdAt: start.toISOString(),
        },
        students: [
            { anonId: "anon_ALEX_01", displayName: "Alex", status: "GRADED", attemptCount: 2, scorePct: 88, submittedAt: now.toISOString(), gradedAt: now.toISOString() },
            { anonId: "anon_BLAIR_02", displayName: "Blair", status: "SUBMITTED", attemptCount: 1, scorePct: 72, submittedAt: now.toISOString(), gradedAt: "" },
            { anonId: "anon_CASEY_03", displayName: "Casey", status: "ASSIGNED", attemptCount: 0, scorePct: "", submittedAt: "", gradedAt: "" },
        ],
    };
}
