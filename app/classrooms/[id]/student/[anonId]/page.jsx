// app/classrooms/[id]/student/[anonId]/page.jsx
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Navbar from "../../../../Navbar";
import styles from "../../../../dashboard/Dashboard.module.css";
const LineCard = dynamic(() => import("../../../../dashboard/_charts/LineCard"), { ssr: false });

export default function StudentDrill({ params }) {
    const { id } = await ctx.params; // ✅
    const num = Number(id);
    const anonId = decodeURIComponent(params?.anonId || "");
    const [m, setM] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${id}/student/${encodeURIComponent(anonId)}/metrics`);
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed");
                setM(j.data);
            } catch (e) { setErr(e.message || "Failed to load"); }
        })();
    }, [id, anonId]);

    const exportHref = m
        ? `/api/classrooms/${id}/student/${encodeURIComponent(anonId)}/metrics/export?from=${m.from}&to=${m.to}`
        : "#";

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <a href={`/classrooms/${id}`} className={styles.btnSecondary}>← Back</a>
                <h1 style={{ marginTop: 8, marginBottom: 0 }}>Student</h1>
                <p className={styles.dim}><code>{anonId}</code> • Window: {m?.from} → {m?.to} • Attempts: {m?.attempts ?? 0}</p>
                {err && <p style={{ color: "#b91c1c" }}>{err}</p>}

                <div style={{ marginBottom: 8 }}>
                    <a href={exportHref} className={styles.btn}>Export CSV (ZIP)</a>
                </div>

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
                    <h4 className={styles.h4}>Weak subtopics</h4>
                    {m?.weak?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {m.weak.map((w, i) => (
                                <li key={i} style={{ marginBottom: 6 }}>
                                    <strong>{w.concept}</strong> — {w.subTopic} · Avg {Math.round(w.avg)}% · {w.attempts} attempts
                                </li>
                            ))}
                        </ul>
                    ) : <p className={styles.dim}>No weak topics yet.</p>}
                </section>

                <section className={styles.card} style={{ marginTop: 12 }}>
                    <h4 className={styles.h4}>Recent notes</h4>
                    {m?.notesRecent?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {m.notesRecent.map((n) => (
                                <li key={n.id} style={{ marginBottom: 6 }}>
                                    [{n.targetType}] {n.anchorText || "—"} {n.isBookmark ? "🔖" : ""}
                                    <span style={{ marginLeft: 6, fontSize: 12, color: "#6b7280" }}>
                                        {new Date(n.createdAt).toLocaleString?.() || n.createdAt}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className={styles.dim}>No notes in range.</p>}
                </section>
            </main>
        </>
    );
}
