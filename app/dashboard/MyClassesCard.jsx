// app/dashboard/MyClassesCard.jsx
"use client";
import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

export default function MyClassesCard() {
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/my/classes", { cache: "no-store" });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load classes");
                if (!dead) setRows(j.data || []);
            } catch (e) {
                if (!dead) setErr(e.message || "Failed to load classes");
            }
        })();
        return () => { dead = true; };
    }, []);

    if (err) return <section className={styles.card}><p className={styles.dim}>{err}</p></section>;
    if (!rows.length) return null;

    return (
        <section className={styles.card}>
            <h3 className={styles.h4}>My classes</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {rows.map(c => (
                    <div key={c.classroomId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                            <a href={`/classrooms/${c.classroomId}`} className={styles.btnSecondary} style={{ marginRight: 8 }}>
                                {c.classroomName}
                            </a>
                            <RoleBadge role={c.role} />
                        </div>
                        <div>
                            <code style={{ padding: "2px 6px", background: "#f3f4f6", borderRadius: 6 }}>{c.classroomCode || "—"}</code>
                            <button className={styles.btnSecondary} onClick={() => copy(c.classroomCode)} style={{ marginLeft: 6 }}>Copy</button>
                            <a className={styles.btnSecondary} href={`/api/qrcode?text=${encodeURIComponent(c.classroomCode || "")}`} target="_blank" style={{ marginLeft: 6 }}>
                                QR
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function copy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast("Copied")).catch(() => toast("Copy failed", true));
}

function RoleBadge({ role }) {
    const r = (role || "student").toLowerCase();
    const label = r === "teacher" ? "Teacher" : "Student";
    const bg = r === "teacher" ? "#ecfeff" : "#eef2ff";
    const color = r === "teacher" ? "#155e75" : "#3730a3";
    return (
        <span style={{ background: bg, color, borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
            {label}
        </span>
    );
}

function toast(msg, danger = false) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: danger ? "#991b1b" : "#111827", color: "#fff",
        padding: "8px 12px", borderRadius: 8, zIndex: 9999
    });
    document.body.appendChild(el);
    setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1200);
}
