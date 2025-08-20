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

    // grade drawer (single)
    const [grading, setGrading] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState("");

    // bulk select
    const [selected, setSelected] = useState(() => new Set());
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
    const [bulkScorePct, setBulkScorePct] = useState("");

    useEffect(() => {
        let dead = false;
        const ctl = new AbortController();
        (async () => {
            try {
                if (demo) {
                    if (!dead) setData(demoPayload());
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

    // ---- single grade drawer ----
    function openGrade(r) {
        setSaveErr("");
        setGrading({
            anonId: r.anonId,
            displayName: r.displayName || "",
            status: r.status || "ASSIGNED",
            scorePct: r.scorePct === "" || r.scorePct == null ? "" : String(r.scorePct),
            scorePoints: "",
            feedback: "",
            isLate: false,
        });
    }
    function closeGrade() {
        setGrading(null);
        setSaving(false);
        setSaveErr("");
    }
    async function submitGrade(e) {
        e?.preventDefault?.();
        if (!grading || !a) return;
        setSaving(true);
        setSaveErr("");
        try {
            const body = {
                anonId: grading.anonId,
                status: grading.status,
                scorePct: grading.scorePct === "" ? undefined : Number(grading.scorePct),
                scorePoints: grading.scorePoints === "" ? undefined : Number(grading.scorePoints),
                feedback: grading.feedback || undefined,
                isLate: !!grading.isLate,
            };
            const r = await fetch(`/api/assignments/${a.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to save");

            setData(prev => {
                if (!prev) return prev;
                const nextRows = prev.students.map(row =>
                    row.anonId === grading.anonId
                        ? {
                            ...row,
                            status: j.data.status || grading.status,
                            scorePct: j.data.scorePct ?? row.scorePct,
                            gradedAt: j.data.gradedAt || new Date().toISOString(),
                        }
                        : row
                );
                return { ...prev, students: nextRows };
            });
            closeGrade();
            toast("Saved");
        } catch (e) {
            setSaveErr(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }
    useEffect(() => {
        function onKey(e) { if (e.key === "Escape") closeGrade(); }
        if (grading) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [grading]);

    // ---- selection + bulk actions ----
    const allIds = useMemo(() => rows.map(r => r.anonId), [rows]);
    const allSelected = selected.size > 0 && selected.size === allIds.length;

    function toggleRow(id) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function toggleAll(e) {
        const checked = e.target.checked;
        setSelected(checked ? new Set(allIds) : new Set());
    }
    function clearSelection() {
        setSelected(new Set());
        setBulkScorePct("");
        setBulkProgress({ done: 0, total: 0 });
    }

    async function bulkApply(kind) {
        if (!a || selected.size === 0) return;
        // validate optional score when grading
        let scoreVal = undefined;
        if (kind === "GRADED" && String(bulkScorePct).trim() !== "") {
            const n = Number(bulkScorePct);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
                toast("Enter a valid Score % (0–100)");
                return;
            }
            scoreVal = n;
        }

        const ids = Array.from(selected);
        setBulkSaving(true);
        setBulkProgress({ done: 0, total: ids.length });

        let failures = 0;
        for (let i = 0; i < ids.length; i++) {
            const anonId = ids[i];
            try {
                const body = {
                    anonId,
                    status: kind,
                    isLate: kind === "LATE" ? true : undefined,
                    scorePct: kind === "GRADED" ? scoreVal : undefined,
                };
                const r = await fetch(`/api/assignments/${a.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed");
                // optimistic local update
                setData(prev => {
                    if (!prev) return prev;
                    const nextRows = prev.students.map(row =>
                        row.anonId === anonId
                            ? {
                                ...row,
                                status: j.data.status || kind,
                                scorePct: j.data.scorePct ?? (kind === "GRADED" ? scoreVal ?? row.scorePct : row.scorePct),
                                gradedAt: (kind === "GRADED" ? (j.data.gradedAt || new Date().toISOString()) : row.gradedAt),
                            }
                            : row
                    );
                    return { ...prev, students: nextRows };
                });
            } catch {
                failures += 1;
            } finally {
                setBulkProgress({ done: i + 1, total: ids.length });
            }
        }

        setBulkSaving(false);
        if (failures === 0) {
            toast(`Applied to ${ids.length} student${ids.length > 1 ? "s" : ""}`);
        } else {
            toast(`Done with ${failures} error${failures > 1 ? "s" : ""}`);
        }
        clearSelection();
    }

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
                                        <th style={thNarrow}>
                                            <input
                                                type="checkbox"
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th style={th}>Student</th>
                                        <th style={th}>Anon ID</th>
                                        <th style={th}>Status</th>
                                        <th style={th}>Attempts</th>
                                        <th style={th}>Score</th>
                                        <th style={th}>Submitted</th>
                                        <th style={th}>Graded</th>
                                        <th style={th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const isSel = selected.has(r.anonId);
                                        return (
                                            <tr key={r.anonId} style={trBody}>
                                                <td style={tdNarrow}>
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select ${r.displayName || r.anonId}`}
                                                        checked={isSel}
                                                        onChange={() => toggleRow(r.anonId)}
                                                    />
                                                </td>
                                                <td style={td}><strong>{r.displayName || r.anonId?.slice(0, 8) + "…"}</strong></td>
                                                <td style={td}><code>{r.anonId}</code></td>
                                                <td style={td}>{statusChip(r.status)}</td>
                                                <td style={td}>{r.attemptCount ?? 0}</td>
                                                <td style={td}>{r.scorePct !== "" && r.scorePct != null ? `${r.scorePct}%` : "—"}</td>
                                                <td style={td}>{fmtMaybe(r.submittedAt)}</td>
                                                <td style={td}>{fmtMaybe(r.gradedAt)}</td>
                                                <td style={td}>
                                                    <button className={styles.btnSecondary} onClick={() => openGrade(r)}>Grade</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {rows.length === 0 && (
                                        <tr><td style={td} colSpan={9} className={styles.dim}>No targeted students yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Bulk bar (appears when items selected) */}
            {selected.size > 0 && (
                <div style={bulkBar} role="region" aria-label="Bulk actions">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span><strong>{selected.size}</strong> selected</span>
                        <button className={styles.btnSecondary} onClick={clearSelection} disabled={bulkSaving}>Clear</button>
                        <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                        <button className={styles.btnSecondary} onClick={() => bulkApply("MISSING")} disabled={bulkSaving}>Mark Missing</button>
                        <button className={styles.btnSecondary} onClick={() => bulkApply("LATE")} disabled={bulkSaving}>Mark Late</button>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button className={styles.btnSecondary} onClick={() => bulkApply("GRADED")} disabled={bulkSaving}>Mark Graded</button>
                            <label className={styles.dim} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                Score % (optional)
                                <input
                                    className={styles.input}
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    style={{ width: 90, padding: "4px 8px" }}
                                    value={bulkScorePct}
                                    onChange={(e) => setBulkScorePct(e.target.value)}
                                    aria-label="Bulk score percent"
                                />
                            </label>
                        </div>
                        {bulkSaving && (
                            <span className={styles.dim}>
                                Updating {bulkProgress.done}/{bulkProgress.total}…
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Grade Drawer (single) */}
            {grading && (
                <div role="dialog" aria-label="Grade student" aria-modal="true"
                    style={drawerOverlay}
                    onClick={(e) => { if (e.target === e.currentTarget) closeGrade(); }}>
                    <div style={drawerPanel}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 className={styles.h4} style={{ margin: 0 }}>Grade — {grading.displayName || grading.anonId}</h3>
                            <button className={styles.btnSecondary} onClick={closeGrade}>Close</button>
                        </div>

                        <form onSubmit={submitGrade} style={{ marginTop: 12, display: "grid", gap: 10 }}>
                            <label style={labelRow}>
                                <span style={labelText}>Status</span>
                                <select className={styles.input}
                                    value={grading.status}
                                    onChange={(e) => setGrading(g => ({ ...g, status: e.target.value }))}>
                                    <option>ASSIGNED</option>
                                    <option>SUBMITTED</option>
                                    <option>GRADED</option>
                                    <option>LATE</option>
                                    <option>MISSING</option>
                                </select>
                            </label>

                            <label style={labelRow}>
                                <span style={labelText}>Score %</span>
                                <input className={styles.input} type="number" min="0" max="100" step="1"
                                    value={grading.scorePct}
                                    onChange={(e) => setGrading(g => ({ ...g, scorePct: e.target.value }))} />
                            </label>

                            <label style={labelRow}>
                                <span style={labelText}>Score (pts)</span>
                                <input className={styles.input} type="number" step="1"
                                    value={grading.scorePoints}
                                    onChange={(e) => setGrading(g => ({ ...g, scorePoints: e.target.value }))} />
                            </label>

                            <label style={labelRow}>
                                <span style={labelText}>Feedback</span>
                                <textarea className={styles.input}
                                    rows={3}
                                    value={grading.feedback}
                                    onChange={(e) => setGrading(g => ({ ...g, feedback: e.target.value }))} />
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input type="checkbox"
                                    checked={grading.isLate}
                                    onChange={(e) => setGrading(g => ({ ...g, isLate: e.target.checked }))} />
                                <span>Mark late</span>
                            </label>

                            {saveErr && <p style={{ color: "#b91c1c", margin: 0 }}>{saveErr}</p>}

                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                <button type="button" className={styles.btnSecondary} onClick={closeGrade} disabled={saving}>Cancel</button>
                                <button type="submit" className={styles.btn} disabled={saving}>{saving ? "Saving…" : "Save grade"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

const trHead = { background: "#f9fafb", borderBottom: "1px solid #e5e7eb" };
const trBody = { borderBottom: "1px solid #f3f4f6" };
const th = { textAlign: "left", padding: "10px 12px", fontWeight: 600 };
const thNarrow = { ...th, width: 40 };
const td = { padding: "10px 12px", verticalAlign: "top" };
const tdNarrow = { ...td, width: 40 };

const drawerOverlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50
};
const drawerPanel = {
    width: "min(420px, 100%)", background: "#fff", height: "100%", padding: 16, boxShadow: "rgba(0,0,0,0.1) -8px 0 24px",
    overflowY: "auto", borderLeft: "1px solid #e5e7eb"
};
const bulkBar = {
    position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)", zIndex: 40
};
const labelRow = { display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 };
const labelText = { color: "#374151", fontSize: 13 };

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
    return <span style={{ background: v.bg, color: v.color, borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{v.label}</span>;
}
function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? iso : new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(d);
}
function fmtMaybe(v) {
    if (!v) return "—";
    const iso = typeof v === "string" ? v : v?.toString?.();
    return fmtDateTime(iso);
}
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
function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}
