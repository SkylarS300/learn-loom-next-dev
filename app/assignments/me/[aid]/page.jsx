// app/assignments/me/[aid]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "../../../Navbar";
import styles from "../../../dashboard/Dashboard.module.css";

export default function MyAssignmentPage() {
    const { aid } = useParams();
    const id = Number(aid);

    const [data, setData] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch(`/api/assignments/${id}/me`, { cache: "no-store" });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load");
                if (!dead) setData(j.data);
            } catch (e) { if (!dead) setErr(e.message || "Failed to load"); }
            finally { if (!dead) setLoading(false); }
        })();
        return () => { dead = true; };
    }, [id]);

    const a = data?.assignment, me = data?.me;

    function workLink() {
        if (!a) return "#";
        if (a.type === "BOOK" && Number.isInteger(a.bookId) && Number.isInteger(a.chapterIndex))
            return `/readingpal?bookIndex=${a.bookId}&chapterIndex=${a.chapterIndex}&from=assign:${a.id}`;
        if (a.type === "QUIZ" && a.category)
            return `/grammar?concept=${encodeURIComponent(a.category)}&subTopic=${encodeURIComponent(a.subtopic || "")}&start=1&from=assign:${a.id}`;
        if (a.type === "UPLOAD" && Number.isInteger(a.uploadId))
            return `/uploads/${a.uploadId}?from=assign:${a.id}`;
        return "#";
    }

    async function act(action) {
        setSaving(true);
        try {
            const r = await fetch(`/api/assignments/${id}/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Action failed");
            // refresh
            const r2 = await fetch(`/api/assignments/${id}/me`, { cache: "no-store" });
            const j2 = await r2.json();
            setData(j2.data);
            toast("Updated");
        } catch (e) { toast(e.message || "Failed", true); }
        finally { setSaving(false); }
    }

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <a href="/dashboard" className={styles.btnSecondary}>← Back</a>
                {loading && <p className={styles.dim}>Loading…</p>}
                {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}
                {a && me && (
                    <>
                        <h1 style={{ marginTop: 8, marginBottom: 6 }}>{a.title}</h1>
                        <p className={styles.dim} style={{ marginTop: 0 }}>
                            {badge(a.type)}
                            {a.startAt ? <> · Starts: {fmtDT(a.startAt)}</> : null}
                            {a.dueDate ? <> · Due: {fmtDT(a.dueDate)}</> : null}
                            {" · "}Allow late: {a.allowLate ? "Yes" : "No"}
                            {a.latePenaltyPct != null ? ` (${a.latePenaltyPct}% penalty)` : ""}
                            {a.weightPoints != null ? ` · Weight: ${a.weightPoints} pts` : ""}
                        </p>

                        <div className={styles.card}>
                            <p>Status: <strong>{me.status}</strong> {me.isLate ? <em style={{ color: "#9a3412" }}>(Late)</em> : null}</p>
                            <p>Attempts: {me.attemptCount ?? 0}</p>
                            <p>Submitted: {fmtMaybe(me.submittedAt)}</p>
                            <p>Graded: {fmtMaybe(me.gradedAt)}</p>
                            {me.scorePct != null && me.scorePct !== "" && <p>Score: {me.scorePct}%</p>}
                            {me.feedback && (
                                <div style={{ marginTop: 8 }}>
                                    <h4 className={styles.h4} style={{ marginTop: 0 }}>Private feedback</h4>
                                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                                        {me.feedback}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                <a className={styles.btnSecondary} href={workLink()}>Open work</a>
                                {me.status === "ASSIGNED" && (
                                    <button className={styles.btn} onClick={() => act("submit")} disabled={saving}>Turn in</button>
                                )}
                                {me.status === "SUBMITTED" && !me.gradedAt && (
                                    <>
                                        <button className={styles.btnSecondary} onClick={() => act("unsubmit")} disabled={saving}>Unsubmit</button>
                                        <button className={styles.btn} onClick={() => act("resubmit")} disabled={saving}>Resubmit</button>
                                    </>
                                )}
                                {me.status === "GRADED" && (
                                    <button className={styles.btn} onClick={() => act("resubmit")} disabled={saving}>Resubmit</button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}

function badge(t) { return <span style={{ border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>{t}</span>; }
function fmtDT(iso) { const d = new Date(iso); return isNaN(d) ? iso : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d); }
function fmtMaybe(iso) { return iso ? fmtDT(iso) : "—"; }
function toast(msg, danger = false) { const el = document.createElement("div"); el.textContent = msg; Object.assign(el.style, { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: danger ? "#991b1b" : "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999 }); document.body.appendChild(el); setTimeout(() => el.remove(), 1100); }
