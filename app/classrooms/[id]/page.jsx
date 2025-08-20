// app/classrooms/[id]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "../../Navbar";
import styles from "../../dashboard/Dashboard.module.css";

const LineCard = dynamic(() => import("../../dashboard/_charts/LineCard"), { ssr: false });

export default function ClassroomPage() {
    const { id } = useParams();        // id is a string from the URL
    const classId = Number(id);
    const [m, setM] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    // assignments
    const [alist, setAlist] = useState([]);
    const [aErr, setAErr] = useState("");
    const [aLoading, setALoading] = useState(true);
    const demoAssignments =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("demoAssignments") === "1";
    useEffect(() => {
        if (!Number.isFinite(classId)) { setErr("Bad classroom id in URL"); setLoading(false); return; }
        const ctl = new AbortController();
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/metrics`, { cache: "no-store", signal: ctl.signal });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed");
                setM(j.data);
            } catch (e) {
                if (e.name !== "AbortError") setErr(e.message || "Failed to load");
            } finally {
                setLoading(false);
            }
        })();
        return () => ctl.abort();
    }, [classId]);

    // load assignments (teacher only; falls back to demo if ?demoAssignments=1)
    useEffect(() => {
        if (!Number.isFinite(classId)) return;
        const ctl = new AbortController();
        let dead = false;
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/assignments`, { cache: "no-store", signal: ctl.signal });
                if (r.status === 403 && demoAssignments) {
                    if (!dead) { setAlist(demoRows()); }
                    return;
                }
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load assignments");
                if (!dead) setAlist(j.data || []);
            } catch (e) {
                if (demoAssignments) {
                    if (!dead) setAlist(demoRows());
                } else {
                    if (!dead) setAErr(e.message || "Failed to load assignments");
                }
            } finally {
                if (!dead) setALoading(false);
            }
        })();
        return () => { dead = true; ctl.abort(); };
    }, [classId, demoAssignments]);


    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <Link href="/dashboard" className={styles.btnSecondary}>← Back</Link>
                <h1 style={{ marginTop: 8, marginBottom: 0 }}>{m?.classroom?.name || "Classroom"}</h1>
                <p className={styles.dim}>Students: {m?.roster?.students ?? 0} • Window: {m?.from} → {m?.to}</p>
                {m && m.canExport && (
                    <div style={{ margin: "8px 0" }}>
                        <a
                            className={styles.btn}
                            href={`/classrooms/${m.classroom.id}/assignments/new`}
                            style={{ marginRight: 8 }}
                        >
                            + New assignment
                        </a>
                        <a
                            className={styles.btn}
                            href={`/api/classrooms/${m.classroom.id}/metrics/export?from=${m.from}&to=${m.to}`}
                        >
                            Export CSV (ZIP)
                        </a>
                    </div>
                )}
                {loading && <p className={styles.dim}>Loading…</p>}
                {err && !loading && <p style={{ color: "#b91c1c" }}>{err}</p>}

                <section className={styles.section}>
                    <LineCard title="Reading minutes / day" data={m?.readingDaily || []} yKey="minutes" />
                    <div style={{ marginTop: 12 }}>
                        <LineCard title="Grammar average score / day" data={m?.grammarDaily || []} yKey="avg" yDomain={[0, 100]} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <LineCard title="Grammar pace (sec / question)" data={m?.grammarPaceDaily || []} yKey="secPerQ" />
                    </div>
                </section>

                <section className={styles.card} style={{ marginTop: 12 }}>
                    <h4 className={styles.h4}>Top weak subtopics</h4>
                    {m?.topWeakAreas?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {m.topWeakAreas.map((w, i) => (
                                <li key={i} style={{ marginBottom: 6 }}>
                                    <strong>{w.concept}</strong> — {w.subTopic} · Avg {Math.round(w.avg)}% · {w.attempts} attempts
                                </li>
                            ))}
                        </ul>
                    ) : <p className={styles.dim}>No data yet.</p>}
                </section>

                <section className={styles.card} style={{ marginTop: 12 }}>
                    <h4 className={styles.h4}>Notes per student</h4>
                    {m?.notesPerStudent?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {m.notesPerStudent.map((r) => (
                                <li key={r.anonId}>
                                    <Link
                                        href={`/classrooms/${m.classroom.id}/student/${encodeURIComponent(r.anonId)}`}
                                        className={styles.btnSecondary}
                                    >
                                        <code>{r.anonId.slice(0, 8)}…</code>
                                    </Link>{" "}
                                    — {r.count}
                                </li>
                            ))}

                        </ul>
                    ) : <p className={styles.dim}>No notes recorded in the range.</p>}
                </section>

                {/* Assignments table (teacher) */}
                <section className={styles.section}>
                    <div className={styles.headerRow}>
                        <h3 style={{ margin: 0 }}>🗂 Assignments</h3>
                        <div className={styles.growRight}>
                            <a
                                className={styles.btn}
                                href={`/classrooms/${classId}/assignments/new`}
                            >
                                + New assignment
                            </a>
                        </div>
                    </div>
                    {aLoading ? (
                        <p className={styles.dim}>Loading…</p>
                    ) : aErr ? (
                        <p className={styles.dim}>
                            {demoAssignments ? "Showing demo list." : aErr}
                        </p>
                    ) : (
                        <div className={styles.card} style={{ padding: 0, marginTop: 8 }}>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                    <thead>
                                        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                            <th style={th}>Title</th>
                                            <th style={th}>Type</th>
                                            <th style={th}>Start</th>
                                            <th style={th}>Due</th>
                                            <th style={th}>Targeted</th>
                                            <th style={th} colSpan={5}>Counts</th>
                                            <th style={th}>Actions</th>
                                        </tr>
                                        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                            <th></th><th></th><th></th><th></th><th></th>
                                            <th style={thMini}>Assigned</th>
                                            <th style={thMini}>Submitted</th>
                                            <th style={thMini}>Graded</th>
                                            <th style={thMini}>Late</th>
                                            <th style={thMini}>Missing</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(alist || []).map(a => (
                                            <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                                <td style={td}><strong>{a.title}</strong></td>
                                                <td style={td}>{typeLabel(a.type)}</td>
                                                <td style={td}>{fmtMaybe(a.startAt)}</td>
                                                <td style={td}>{fmtMaybe(a.dueDate)}</td>
                                                <td style={td}>{a.targetedCount ?? "—"}</td>
                                                <td style={tdCenter}>{a.counts?.ASSIGNED ?? 0}</td>
                                                <td style={tdCenter}>{a.counts?.SUBMITTED ?? 0}</td>
                                                <td style={tdCenter}>{a.counts?.GRADED ?? 0}</td>
                                                <td style={tdCenter}>{a.counts?.LATE ?? 0}</td>
                                                <td style={tdCenter}>{a.counts?.MISSING ?? 0}</td>
                                                <td style={td}>
                                                    <a className={styles.btnSecondary} href={`/assignments/${a.id}`} style={{ marginRight: 6 }}>View</a>
                                                    <a className={styles.btnSecondary} href={`/api/assignments/${a.id}/export`}>Export</a>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!alist || alist.length === 0) && (
                                            <tr><td style={td} colSpan={11} className={styles.dim}>No assignments yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}


const th = { textAlign: "left", padding: "10px 12px", fontWeight: 600 };
const thMini = { textAlign: "center", padding: "6px 12px", fontWeight: 600, fontSize: 12 };
const td = { padding: "10px 12px", verticalAlign: "top" };
const tdCenter = { padding: "10px 12px", textAlign: "center", verticalAlign: "top" };

function typeLabel(t) {
    if (t === "BOOK") return "Book";
    if (t === "QUIZ") return "Quiz";
    if (t === "UPLOAD") return "Upload";
    return t || "—";
}
function fmtMaybe(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
    } catch { return iso; }
}

function demoRows() {
    const now = Date.now();
    return [
        {
            id: 5001, title: "Chapter 3 Reading", type: "BOOK",
            startAt: new Date(now - 2 * 864e5).toISOString(),
            dueDate: new Date(now + 5 * 864e5).toISOString(),
            targetedCount: 3,
            counts: { ASSIGNED: 1, SUBMITTED: 1, GRADED: 1, LATE: 0, MISSING: 0 },
        },
        {
            id: 5002, title: "Verb Tenses — Quiz A", type: "QUIZ",
            startAt: new Date(now - 1 * 864e5).toISOString(),
            dueDate: new Date(now + 2 * 864e5).toISOString(),
            targetedCount: 3,
            counts: { ASSIGNED: 2, SUBMITTED: 1, GRADED: 0, LATE: 0, MISSING: 0 },
        },
        {
            id: 5003, title: "Upload: “The Moon Landing”", type: "UPLOAD",
            startAt: "", dueDate: "",
            targetedCount: 2,
            counts: { ASSIGNED: 2, SUBMITTED: 0, GRADED: 0, LATE: 0, MISSING: 0 },
        },
    ];
}
