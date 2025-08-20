// app/dashboard/SettingsCard.jsx
"use client";
import { useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

export default function SettingsCard() {
    const [me, setMe] = useState({ loading: true, ok: false });
    const [data, setData] = useState({ teaching: [], enrolled: [] });
    const [name, setName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/session/me", { cache: "no-store" });
                const j = await r.json();
                setMe({ loading: false, ok: !!j?.ok });
            } catch { setMe({ loading: false, ok: false }); }
        })();
    }, []);

    async function refresh() {
        try {
            const r = await fetch("/api/classrooms", { cache: "no-store" });
            const j = await r.json();
            if (j?.ok) setData(j.data);
        } catch { }
    }
    useEffect(() => { refresh(); }, []);

    async function createClassroom() {
        setMsg("");
        try {
            const r = await fetch("/api/classrooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed");
            setName("");
            setMsg("Classroom created");
            await refresh();
        } catch (e) { setMsg(e.message || "Error"); }
    }

    async function join() {
        setMsg("");
        try {
            const r = await fetch("/api/classrooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: joinCode }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed");
            setJoinCode("");
            setMsg("Joined classroom");
            await refresh();
        } catch (e) { setMsg(e.message || "Error"); }
    }

    if (me.loading) return null;

    return (
        <div className={styles.card}>
            <h3 style={{ marginTop: 0 }}>⚙️ Settings / Classrooms</h3>

            {msg && <div style={{ marginBottom: 8, color: "#065f46" }}>{msg}</div>}

            {/* Teaching */}
            <div style={{ marginTop: 8 }}>
                <h4 className={styles.h4}>Your classrooms</h4>
                {data.teaching.length === 0 ? (
                    <p className={styles.dim}>You don’t own a classroom yet.</p>
                ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {data.teaching.map((c) => (
                            <li key={c.id} style={{ marginBottom: 6 }}>
                                <strong>{c.name}</strong>{" "}
                                <span style={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px", background: "#f3f4f6" }}>
                                    {c.code}
                                </span>{" "}
                                <a href={`/classrooms/${c.id}`} className={styles.btnSecondary} style={{ marginLeft: 6 }}>Open</a>
                            </li>
                        ))}
                    </ul>
                )}
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <input
                        className={styles.input}
                        placeholder="New classroom name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div>
                        <button className={styles.btn} disabled={!name.trim()} onClick={createClassroom}>Create classroom</button>
                    </div>
                </div>
            </div>

            {/* Enrolled */}
            <div style={{ marginTop: 16 }}>
                <h4 className={styles.h4}>Join with a code</h4>
                <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
                    <input
                        className={styles.input}
                        placeholder="Enter code (e.g., ABC234)"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                    />
                    <div>
                        <button className={styles.btnSecondary} disabled={!joinCode.trim()} onClick={join}>Join class</button>
                    </div>
                </div>

                {data.enrolled.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        <div className={styles.h4}>Your classes</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {data.enrolled.map((c) => (
                                <li key={c.id} style={{ marginBottom: 6 }}>
                                    <strong>{c.name}</strong>{" "}
                                    <a href={`/classrooms/${c.id}`} className={styles.btnSecondary} style={{ marginLeft: 6 }}>Open</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
