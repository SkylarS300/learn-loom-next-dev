// app/dashboard/TeacherSettingsCard.jsx
"use client";

import { useState } from "react";
import styles from "./Dashboard.module.css";

export default function TeacherSettingsCard() {
    const [isTeacherMode, setIsTeacherMode] = useState(true);

    // Create
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState("");

    // Join
    const [code, setCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [joinAsTeacher, setJoinAsTeacher] = useState(false);
    const [joining, setJoining] = useState(false);
    const [joinMsg, setJoinMsg] = useState("");

    async function onCreate(e) {
        e.preventDefault();
        setCreating(true); setCreateMsg("");
        try {
            const r = await fetch("/api/classrooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, teaderId: 0 }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to create");
            setCreateMsg(`Created "${j.data.name}". Code: ${j.data.code}`);
            // Jump into class
            location.href = `/classrooms/${j.data.id}`;
        } catch (err) {
            setCreateMsg(err.message || "Failed to create");
        } finally {
            setCreating(false);
        }
    }

    async function onJoin(e) {
        e.preventDefault();
        setJoining(true); setJoinMsg("");
        try {
            const r = await fetch("/api/classrooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, displayName, joinAsTeacher }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to join");
            setJoinMsg("Joined!");
            location.href = `/classrooms/${j.data.classroomId}`;
        } catch (err) {
            setJoinMsg(err.message || "Failed to join");
        } finally {
            setJoining(false);
        }
    }

    return (
        <section className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className={styles.h4}>Classrooms</h3>
                <label style={{ fontSize: 14 }}>
                    <input type="checkbox" checked={isTeacherMode} onChange={e => setIsTeacherMode(e.target.checked)} />
                    {" "}I’m a teacher
                </label>
            </div>

            {isTeacherMode ? (
                <form onSubmit={onCreate} className={styles.editWrap} style={{ marginTop: 8 }}>
                    <div className={styles.editRow}>
                        <label style={{ width: 140 }}>Class name</label>
                        <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., 7th Grade ELA — Period 2" />
                    </div>
                    <button className={styles.btn} disabled={creating || !name.trim()}>{creating ? "Creating…" : "Create class"}</button>
                    {createMsg && <p style={{ marginTop: 8 }} className={styles.dim}>{createMsg}</p>}
                    <p className={styles.dim} style={{ marginTop: 8 }}>You’ll be set as the class owner and a teacher in the roster.</p>
                </form>
            ) : (
                <form onSubmit={onJoin} className={styles.editWrap} style={{ marginTop: 8 }}>
                    <div className={styles.editRow}>
                        <label style={{ width: 140 }}>Class code</label>
                        <input className={styles.input} value={code} onChange={e => setCode(e.target.value)} placeholder="e.g., 6YQ9T2" />
                    </div>
                    <div className={styles.editRow}>
                        <label style={{ width: 140 }}>Your display name</label>
                        <input className={styles.input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Visible to class" />
                    </div>
                    <div className={styles.editRow}>
                        <label style={{ width: 140 }}>Join as teacher</label>
                        <input type="checkbox" checked={joinAsTeacher} onChange={e => setJoinAsTeacher(e.target.checked)} />
                    </div>
                    <button className={styles.btn} disabled={joining || !code.trim()}>{joining ? "Joining…" : "Join class"}</button>
                    {joinMsg && <p style={{ marginTop: 8 }} className={styles.dim}>{joinMsg}</p>}
                </form>
            )}
        </section>
    );
}
