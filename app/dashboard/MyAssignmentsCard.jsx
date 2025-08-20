"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";

const BUCKETS = ["DUE_SOON", "MISSING", "COMPLETED"];

function byBucket(items = []) {
    const out = { DUE_SOON: [], MISSING: [], COMPLETED: [] };
    for (const it of items) {
        if (out[it.bucket]) out[it.bucket].push(it);
    }
    return out;
}

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
        }).format(d);
    } catch {
        return iso;
    }
}

export default function MyAssignmentsCard() {
    const [items, setItems] = useState([]);
    const [bucket, setBucket] = useState("DUE_SOON");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // ⚡ ultra-simple demo mode:
    // Visit /dashboard?demoMyAssignments=1 to populate the card without API/DB.
    const demoMode =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("demoMyAssignments") === "1";

    useEffect(() => {
        let dead = false;
        const ctl = new AbortController();

        async function run() {
            setLoading(true);
            setErr("");
            try {
                if (demoMode) {
                    // Demo fixtures — safe, local-only (not persisted)
                    const demo = [
                        {
                            assignmentId: 1001,
                            title: "Chapter 3 Reading",
                            type: "BOOK",
                            dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
                            status: "ASSIGNED",
                            attemptCount: 0,
                            scorePct: "",
                            isLate: false,
                            bucket: "DUE_SOON",
                            href: "/readingpal?bookIndex=2&chapterIndex=2&from=assign:1001",
                        },
                        {
                            assignmentId: 1002,
                            title: "Verb Tenses — Quiz A",
                            type: "QUIZ",
                            dueDate: new Date(Date.now() - 1 * 86400000).toISOString(),
                            status: "ASSIGNED",
                            attemptCount: 0,
                            scorePct: "",
                            isLate: false,
                            bucket: "MISSING",
                            href: "/grammar?concept=verbs&subTopic=past&start=1&from=assign:1002",
                        },
                        {
                            assignmentId: 1003,
                            title: "Upload: “The Moon Landing”",
                            type: "UPLOAD",
                            dueDate: new Date(Date.now() - 3 * 86400000).toISOString(),
                            status: "GRADED",
                            attemptCount: 1,
                            scorePct: 88,
                            isLate: false,
                            bucket: "COMPLETED",
                            href: "/uploads/42?from=assign:1003",
                        },
                    ];
                    if (!dead) setItems(demo);
                } else {
                    const r = await fetch("/api/my/assignments", {
                        cache: "no-store",
                        signal: ctl.signal,
                    });
                    const j = await r.json();
                    if (!j?.ok) throw new Error(j?.error || "Failed to load");
                    if (!dead) setItems(Array.isArray(j.data) ? j.data : []);
                }
            } catch (e) {
                if (!dead) setErr(e.message || "Failed to load");
            } finally {
                if (!dead) setLoading(false);
            }
        }

        run();
        return () => {
            dead = true;
            ctl.abort();
        };
    }, [demoMode]);

    const buckets = useMemo(() => byBucket(items), [items]);

    const current = buckets[bucket] || [];

    return (
        <div className={styles.card}>
            <div className={styles.cardHead}>
                <h3 className={styles.h3} style={{ margin: 0 }}>🗂 My assignments</h3>
                <div className={styles.tabBar}>
                    {BUCKETS.map((b) => (
                        <button
                            key={b}
                            className={bucket === b ? styles.tabActive : styles.tab}
                            onClick={() => setBucket(b)}
                            aria-pressed={bucket === b}
                        >
                            {labelFor(b)}{countBadge(buckets[b]?.length ?? 0)}
                        </button>
                    ))}
                </div>
            </div>

            {demoMode && (
                <p className={styles.dim} style={{ marginTop: 6 }}>
                    Demo mode (add <code>?demoMyAssignments=1</code> to the URL).
                </p>
            )}

            {loading ? (
                <p className={styles.dim} style={{ marginTop: 8 }}>Loading…</p>
            ) : err ? (
                <p style={{ color: "#b91c1c", marginTop: 8 }}>{err}</p>
            ) : current.length === 0 ? (
                <p className={styles.dim} style={{ marginTop: 8 }}>Nothing here yet.</p>
            ) : (
                <ul className={styles.listReset} style={{ marginTop: 10 }}>
                    {current.map((it) => (
                        <li key={it.assignmentId} className={styles.assignmentRow}>
                            <div className={styles.assignmentMain}>
                                <div className={styles.titleRow}>
                                    <span className={styles.assignmentTitle}>{it.title}</span>
                                    <span className={styles.typeBadge}>{prettyType(it.type)}</span>
                                </div>
                                <div className={styles.metaRow}>
                                    <span className={styles.dim}>Due: {fmtDate(it.dueDate)}</span>
                                    <span className={styles.dot} aria-hidden>·</span>
                                    <span className={styles.dim}>
                                        {statusLabel(it.status, it.isLate)}
                                        {it.scorePct !== "" && (
                                            <> — <strong>{it.scorePct}%</strong></>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.assignmentActions}>
                                <a href={it.href} className={styles.btn}>
                                    {ctaFor(it)}
                                </a>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function labelFor(b) {
    if (b === "DUE_SOON") return "Due soon";
    if (b === "MISSING") return "Overdue";
    return "Completed";
}

function countBadge(n) {
    return <span className={styles.countPill}>{n}</span>;
}

function prettyType(t) {
    if (t === "BOOK") return "Book";
    if (t === "QUIZ") return "Quiz";
    if (t === "UPLOAD") return "Upload";
    return t;
}

function statusLabel(s, isLate) {
    if (s === "ASSIGNED") return isLate ? "Assigned (late)" : "Assigned";
    if (s === "SUBMITTED") return "Submitted";
    if (s === "GRADED") return "Graded";
    if (s === "MISSING") return "Missing";
    if (s === "LATE") return "Late";
    return s || "—";
}

function ctaFor(it) {
    if (it.bucket === "COMPLETED") return "View";
    if (it.bucket === "MISSING") return "Start";
    return "Start / Resume";
}
