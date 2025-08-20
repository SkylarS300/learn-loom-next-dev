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
            </main>
        </>
    );
}
