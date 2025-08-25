// app/assignments/[aid]/me/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "../../../Navbar";
import styles from "../../../dashboard/Dashboard.module.css";

export default function AssignmentMePage() {
    const { aid } = useParams();
    const id = Number(aid);

    const [data, setData] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let dead = false;
        const ctl = new AbortController();
        (async () => {
            try {
                const r = await fetch(`/api/assignments/${id}/me`, { cache: "no-store", signal: ctl.signal });
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
    }, [id]);

    async function act(action) {
        try {
            setSaving(true);
            const r = await fetch(`/api/assignments/${id}/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed");
            setData(prev => prev ? { ...prev, me: { ...prev.me, ...j.data } } : prev);
            toast(action === "UNSUBMIT" ? "Unsubmitted" : "Submitted");
        } catch (e) {
            toast(e.message || "Failed", true);
        } finally {
            setSaving(false);
        }
    }

    const a = data?.assignment;
    const me = data?.me;
    const perms = data?.permissions;

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <a href="/dashboard" className={styles.btnSecondary}>← Back</a>

                <h1 style={{ marginTop: 8, marginBottom: 6 }}>{a?.title || "Assignment"}</h1>
                {a && (
                    <p className={styles.dim} style={{ marginTop: 0 }}>
                        {badge(a.type)}
                        {a.startAt ? <> · Starts: {fmtDT(a.startAt)}</> : null}
                        {a.dueDate ? <> · Due: {fmtDT(a.dueDate)}</> : null}
                        {" · "}Allow late: {a.allowLate ? "Yes" : "No"}
                        {a.latePenaltyPct != null ? ` (${a.latePenaltyPct}% penalty)` : ""}
                        {a.weightPoints != null ? ` · Weight: ${a.weightPoints} pts` : ""}
                    </p>
                )}

                {a?.description && (
                    <div className={styles.card} style={{ margin: "8px 0" }}>
                        <h4 className={styles.h4} style={{ marginTop: 0 }}>Instructions</h4>
                        <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{a.description}</p>
                    </div>
                )}

                {loading && <p className={styles.dim}>Loading…</p>}
                {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}

                {!loading && !err && me && (
                    <div className={styles.card} style={{ display: "grid", gap: 10 }}>
                        <div><strong>Status:</strong> {statusChip(me.status)} {me.isLate ? <em className={styles.dim}>&nbsp;(late)</em> : null}</div>
                        <div><strong>Attempts:</strong> {me.attemptCount ?? 0}</div>
                        <div><strong>Submitted:</strong> {fmtMaybe(me.submittedAt)}</div>
                        <div><strong>Graded:</strong> {fmtMaybe(me.gradedAt)}</div>
                        <div><strong>Score:</strong> {me.scorePct != null ? `${me.scorePct}%` : "—"} {me.scorePoints != null ? ` (${me.scorePoints} pts)` : ""}</div>
                        {me.feedback ? (
                            <div>
                                <strong>Private feedback:</strong>
                                <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{me.feedback}</p>
                            </div>
                        ) : null}

                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            {perms?.canSubmit && me.status !== "SUBMITTED" && (
                                <button className={styles.btn} onClick={() => act(me.status === "ASSIGNED" ? "SUBMIT" : "RESUBMIT")} disabled={saving}>
                                    {saving ? "Saving…" : me.status === "ASSIGNED" ? "Submit" : "Resubmit"}
                                </button>
                            )}
                            {perms?.canUnsubmit && (
                                <button className={styles.btnSecondary} onClick={() => act("UNSUBMIT")} disabled={saving}>
                                    {saving ? "Saving…" : "Unsubmit"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

function badge(t) {
    return <span style={{ border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
        {t === "BOOK" ? "Book" : t === "QUIZ" ? "Quiz" : t === "UPLOAD" ? "Upload" : t}
    </span>;
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
function fmtDT(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? iso : new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }).format(d);
}
function fmtMaybe(iso) { return iso ? fmtDT(iso) : "—"; }
function toast(msg, danger = false) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: danger ? "#991b1b" : "#111827", color: "#fff",
        padding: "8px 12px", borderRadius: 8, zIndex: 9999
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}
