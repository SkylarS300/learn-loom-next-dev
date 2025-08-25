// app/classrooms/[id]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "../../Navbar";
import styles from "../../dashboard/Dashboard.module.css";

const LineCard = dynamic(() => import("../../dashboard/_charts/LineCard"), { ssr: false });

export default function ClassroomPage() {
    const { id } = useParams();
    const router = useRouter();
    const classId = Number(id);

    // class info (name, code, my role, my display name, isOwner, myAnonId)
    const [info, setInfo] = useState(null);
    const [iErr, setIErr] = useState("");
    const isTeacher = info?.role === "teacher";
    const isOwner = !!info?.isOwner;

    // metrics
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

    // roster
    const [roster, setRoster] = useState([]);
    const [rErr, setRErr] = useState("");
    const [rLoading, setRLoading] = useState(true);
    const [editMap, setEditMap] = useState({}); // anonId -> draft displayName
    const [roleSaving, setRoleSaving] = useState({}); // anonId -> bool

    // live view
    const [live, setLive] = useState({ data: [], window: null });
    const [lErr, setLErr] = useState("");
    const [lLoading, setLLoading] = useState(true);
    const [liveMode, setLiveMode] = useState("any");
    const [liveMinutes, setLiveMinutes] = useState(5);

    // kick modal
    const [kick, setKick] = useState(null); // { anonId, displayName, token, input }

    // my display name editing (student-self)
    const [myName, setMyName] = useState("");
    const [mySaving, setMySaving] = useState(false);

    // delete class modal (owner)
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // load class info (role + code + owner + my displayName)
    useEffect(() => {
        if (!Number.isFinite(classId)) return;
        let dead = false;
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/info`, { cache: "no-store" });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load class info");
                if (!dead) { setInfo(j.data); setMyName(j.data.myDisplayName || ""); }
            } catch (e) { if (!dead) setIErr(e.message || "Failed to load class info"); }
        })();
        return () => { dead = true; };
    }, [classId]);

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

    // load roster (teacher sees full roster; needed for role edits by owner)
    useEffect(() => {
        if (!Number.isFinite(classId) || !isTeacher) { setRLoading(false); return; }
        const ctl = new AbortController();
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/roster`, { cache: "no-store", signal: ctl.signal });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load roster");
                setRoster(j.data || []);
                setEditMap(Object.fromEntries((j.data || []).map(r => [r.anonId, r.displayName || ""])));
            } catch (e) {
                setRErr(e.message || "Failed to load roster");
            } finally {
                setRLoading(false);
            }
        })();
        return () => ctl.abort();
    }, [classId, isTeacher]);

    // load assignments (teacher only; falls back to demo if ?demoAssignments=1)
    useEffect(() => {
        if (!Number.isFinite(classId) || !isTeacher) { setALoading(false); return; }
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
    }, [classId, demoAssignments, isTeacher]);

    // poll live activity (teacher only)
    useEffect(() => {
        if (!Number.isFinite(classId) || !isTeacher) { setLLoading(false); return; }
        let dead = false;
        let timer = null;
        async function load() {
            try {
                const r = await fetch(
                    `/api/classrooms/${classId}/live?minutes=${encodeURIComponent(liveMinutes)}&mode=${encodeURIComponent(liveMode)}`,
                    { cache: "no-store" }
                );
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load live view");
                if (!dead) { setLive({ data: j.data || [], window: j.window || null }); setLErr(""); }
            } catch (e) {
                if (!dead) setLErr(e.message || "Failed to load live view");
            } finally {
                if (!dead) setLLoading(false);
            }
        }
        load();
        timer = setInterval(load, 10000);
        return () => { dead = true; if (timer) clearInterval(timer); };
    }, [classId, liveMode, liveMinutes, isTeacher]);

    async function saveName(anonId) {
        const displayName = (editMap[anonId] ?? "").trim();
        try {
            const r = await fetch(`/api/classrooms/${classId}/roster/${encodeURIComponent(anonId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to save");
            setRoster(prev => prev.map(p => p.anonId === anonId ? { ...p, displayName: displayName || "" } : p));
            toast("Saved");
        } catch (e) {
            toast(e.message || "Failed to save", true);
        }
    }

    // owner: change role
    async function changeRole(anonId, newRole) {
        try {
            setRoleSaving(prev => ({ ...prev, [anonId]: true }));
            const r = await fetch(`/api/classrooms/${classId}/roster/${encodeURIComponent(anonId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to change role");
            setRoster(prev => prev.map(p => p.anonId === anonId ? { ...p, role: newRole } : p));
            toast("Role updated");
        } catch (e) {
            toast(e.message || "Failed to change role", true);
        } finally {
            setRoleSaving(prev => ({ ...prev, [anonId]: false }));
        }
    }

    // student self-save
    async function saveMyName() {
        if (!info?.myAnonId) return;
        const displayName = (myName ?? "").trim();
        try {
            setMySaving(true);
            const r = await fetch(`/api/classrooms/${classId}/roster/${encodeURIComponent(info.myAnonId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to save");
            setInfo(prev => prev ? { ...prev, myDisplayName: displayName } : prev);
            toast("Saved");
        } catch (e) {
            toast(e.message || "Failed to save", true);
        } finally {
            setMySaving(false);
        }
    }

    function openKick(anonId, displayName, role) {
        if (role === "teacher") { toast("Teachers can't be removed", true); return; }
        const token = `REMOVE-${anonId.slice(0, 8).toUpperCase()}`;
        setKick({ anonId, displayName: displayName || "", token, input: "" });
    }

    async function doKick() {
        if (!kick) return;
        if (kick.input !== kick.token) { toast("Token does not match", true); return; }
        try {
            const r = await fetch(`/api/classrooms/${classId}/roster/${encodeURIComponent(kick.anonId)}`, { method: "DELETE" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to remove");
            setRoster(prev => prev.filter(p => p.anonId !== kick.anonId));
            setKick(null);
            toast("Removed");
        } catch (e) {
            toast(e.message || "Failed to remove", true);
        }
    }

    async function doDeleteClass() {
        try {
            setDeleting(true);
            const r = await fetch(`/api/classrooms/${classId}`, { method: "DELETE" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Delete failed");
            toast("Class deleted");
            router.push("/dashboard");
        } catch (e) {
            toast(e.message || "Delete failed", true);
        } finally {
            setDeleting(false);
            setShowDelete(false);
        }
    }

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <Link href="/dashboard" className={styles.btnSecondary}>← Back</Link>
                <h1 style={{ marginTop: 8, marginBottom: 0 }}>{info?.name || m?.classroom?.name || "Classroom"}</h1>

                {info?.code && (
                    <p className={styles.dim} style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        Class code: <CopyCode code={info.code} />
                        <a href={`/api/qrcode?text=${encodeURIComponent(info.code)}`} target="_blank" className={styles.btnSecondary}>Show QR</a>
                        {isOwner && (
                            <button className={styles.btnDanger} onClick={() => setShowDelete(true)} style={{ marginLeft: 8 }}>
                                Delete class
                            </button>
                        )}
                    </p>
                )}

                <p className={styles.dim}>Students: {m?.roster?.students ?? 0} • Window: {m?.from} → {m?.to}</p>

                {m && m.canExport && (
                    <div style={{ margin: "8px 0" }}>
                        <a className={styles.btn} href={`/classrooms/${m.classroom.id}/assignments/new`} style={{ marginRight: 8 }}>+ New assignment</a>
                        <a className={styles.btn} href={`/api/classrooms/${m.classroom.id}/metrics/export?from=${m.from}&to=${m.to}`}>Export CSV (ZIP)</a>
                    </div>
                )}

                {loading && <p className={styles.dim}>Loading…</p>}
                {(err || iErr) && !loading && <p style={{ color: "#b91c1c" }}>{err || iErr}</p>}

                {/* Student-only: my assignments for this class */}
                {!isTeacher && (
                    <section className={styles.section}>
                        <div className={styles.headerRow}>
                            <h3 style={{ margin: 0 }}>🗂 My assignments (this class)</h3>
                            <span className={styles.dim}>Due soon & Missing</span>
                        </div>
                        <ClassAssignmentsList classId={classId} />
                    </section>
                )}

                {/* Live view (teacher only)*/}
                {isTeacher && (
                    <section className={styles.section}>
                        <div className={styles.headerRow}>
                            <h3 style={{ margin: 0 }}>🟢 Active now</h3>
                            <div className={styles.growRight} style={{ gap: 8 }}>
                                <label className={styles.dim} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    Mode:
                                    <select className={styles.input} value={liveMode} onChange={(e) => setLiveMode(e.target.value)} style={{ maxWidth: 160 }}>
                                        <option value="any">Any</option>
                                        <option value="reading">Reading</option>
                                        <option value="grammar">Grammar</option>
                                        <option value="upload">Upload</option>
                                    </select>
                                </label>
                                <label className={styles.dim} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    Window:
                                    <select className={styles.input} value={String(liveMinutes)} onChange={(e) => setLiveMinutes(Number(e.target.value))} style={{ maxWidth: 120 }}>
                                        <option value="3">3 min</option>
                                        <option value="5">5 min</option>
                                        <option value="10">10 min</option>
                                        <option value="15">15 min</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        {lLoading ? (
                            <p className={styles.dim}>Loading…</p>
                        ) : lErr ? (
                            <p className={styles.dim}>{lErr}</p>
                        ) : (
                            <div className={styles.card} style={{ padding: 0, marginTop: 8 }}>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                                <th style={th}>Display name</th>
                                                <th style={th}>Anon ID</th>
                                                <th style={th}>Role</th>
                                                <th style={th}>Last seen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(live.data || []).map((u) => (
                                                <tr key={u.anonId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                                    <td style={td}>{u.displayName || "—"}</td>
                                                    <td style={td}><code>{u.anonId}</code></td>
                                                    <td style={td}><RoleBadge role={u.role} /></td>
                                                    <td style={td}>{timeAgo(u.lastSeen)}</td>
                                                </tr>
                                            ))}
                                            {(!live.data || live.data.length === 0) && (
                                                <tr><td style={td} colSpan={4} className={styles.dim}>No one active in this window.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {live.window && (
                            <p className={styles.dim} style={{ marginTop: 6 }}>
                                Window: {fmtMaybeDT(live.window.from)} → {fmtMaybeDT(live.window.to)}
                            </p>
                        )}
                    </section>
                )}

                {/* Roster (teacher)*/}
                {isTeacher && (
                    <section className={styles.section}>
                        <div className={styles.headerRow}>
                            <h3 style={{ margin: 0 }}>👥 Roster</h3>
                            <div className={styles.growRight}>
                                <span className={styles.dim}>{isOwner ? "Edit names, change roles, or remove students" : "Edit names or remove students"}</span>
                            </div>
                        </div>

                        {rLoading ? (
                            <p className={styles.dim}>Loading…</p>
                        ) : rErr ? (
                            <p className={styles.dim}>{rErr}</p>
                        ) : (
                            <div className={styles.card} style={{ padding: 0, marginTop: 8 }}>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                                <th style={th}>Display name</th>
                                                <th style={th}>Anon ID</th>
                                                <th style={th}>Role</th>
                                                <th style={th}>Reading (7d)</th>
                                                <th style={th}>Quiz avg (7d)</th>
                                                <th style={th}>Last seen</th>
                                                <th style={th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(roster || []).map(r => {
                                                const rowIsTeacher = (r.role || "student") === "teacher";
                                                return (
                                                    <tr key={r.anonId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                                        <td style={td}>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <input
                                                                    className={styles.input}
                                                                    style={{ maxWidth: 220 }}
                                                                    value={editMap[r.anonId] ?? ""}
                                                                    onChange={(e) => setEditMap(prev => ({ ...prev, [r.anonId]: e.target.value }))}
                                                                    placeholder="e.g., Alex R."
                                                                />
                                                                <button
                                                                    className={styles.btnSecondary}
                                                                    onClick={() => saveName(r.anonId)}
                                                                    disabled={false /* teachers can edit students' names; extra checks happen server-side */}
                                                                    title="Save name"
                                                                >
                                                                    Save
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td style={td}><code>{r.anonId}</code></td>
                                                        <td style={td}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <RoleBadge role={r.role} />
                                                                {isOwner && r.anonId !== info?.myAnonId && (
                                                                    <select
                                                                        className={styles.input}
                                                                        style={{ maxWidth: 140 }}
                                                                        value={(r.role || "student")}
                                                                        disabled={!!roleSaving[r.anonId]}
                                                                        onChange={(e) => changeRole(r.anonId, e.target.value)}
                                                                    >
                                                                        <option value="student">student</option>
                                                                        <option value="teacher">teacher</option>
                                                                    </select>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={td}>{(r.stats?.readingMin7d ?? 0)} min</td>
                                                        <td style={td}>{r.stats?.quizAvgPct7d != null ? `${r.stats.quizAvgPct7d}%` : "—"}</td>
                                                        <td style={td}>{fmtMaybeDT(r.stats?.lastSeen)}</td>
                                                        <td style={td}>
                                                            <button
                                                                className={styles.btnDanger}
                                                                onClick={() => openKick(r.anonId, editMap[r.anonId] ?? r.displayName ?? "", r.role)}
                                                                disabled={rowIsTeacher}
                                                                title={rowIsTeacher ? "Cannot remove teachers" : "Remove from class"}
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {(!roster || roster.length === 0) && (
                                                <tr><td style={td} colSpan={7} className={styles.dim}>No members yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                <section className={styles.section}>
                    <LineCard title="Reading minutes / day" data={m?.readingDaily || []} yKey="minutes" />
                    <div style={{ marginTop: 12 }}>
                        <LineCard title="Grammar average score / day" data={m?.grammarDaily || []} yKey="avg" yDomain={[0, 100]} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <LineCard title="Grammar pace (sec / question)" data={m?.grammarPaceDaily || []} yKey="secPerQ" />
                    </div>
                </section>

                {/* Weak areas + Notes-per-student (teacher) */}
                {isTeacher && (
                    <>
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
                                            <Link href={`/classrooms/${m.classroom.id}/student/${encodeURIComponent(r.anonId)}`} className={styles.btnSecondary}>
                                                <code>{r.anonId.slice(0, 8)}…</code>
                                            </Link>{" "}
                                            — {r.count}
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className={styles.dim}>No notes recorded in the range.</p>}
                        </section>
                    </>
                )}

                {/* Assignments table (teacher) */}
                {isTeacher && (
                    <section className={styles.section}>
                        <div className={styles.headerRow}>
                            <h3 style={{ margin: 0 }}>🗂 Assignments</h3>
                        </div>
                        {aLoading ? (
                            <p className={styles.dim}>Loading…</p>
                        ) : aErr ? (
                            <p className={styles.dim}>{demoAssignments ? "Showing demo list." : aErr}</p>
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
                )}

                {kick && (
                    <ConfirmKickModal
                        token={kick.token}
                        displayName={kick.displayName}
                        anonId={kick.anonId}
                        value={kick.input}
                        onChange={(v) => setKick(prev => ({ ...prev, input: v }))}
                        onCancel={() => setKick(null)}
                        onConfirm={doKick}
                    />
                )}

                {showDelete && (
                    <ConfirmDeleteClassModal
                        className={info?.name || "Classroom"}
                        onCancel={() => setShowDelete(false)}
                        onConfirm={doDeleteClass}
                        deleting={deleting}
                    />
                )}
            </main>
        </>
    );
}

function CopyCode({ code }) {
    if (!code) return null;
    const copy = async () => {
        try { await navigator.clipboard.writeText(code); toast("Copied"); } catch { toast("Copy failed", true); }
    };
    return (
        <span>
            <code style={{ padding: "2px 6px", background: "#f3f4f6", borderRadius: 6 }}>{code}</code>
            <button className={styles.btnSecondary} onClick={copy} style={{ marginLeft: 6 }}>Copy</button>
        </span>
    );
}

function timeAgo(iso) {
    if (!iso) return "—";
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - d) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
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

function ConfirmKickModal({ token, displayName, anonId, value, onChange, onCancel, onConfirm }) {
    return (
        <div role="dialog" aria-modal="true" aria-label="Confirm removal"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 50 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, width: 460, maxWidth: "95vw", border: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: "0 0 6px" }}>Remove from class?</h3>
                <p style={{ margin: "0 0 10px", color: "#374151" }}>
                    You’re removing <strong>{displayName || anonId.slice(0, 8) + "…"}</strong> (<code>{anonId}</code>) from this classroom.
                </p>
                <p className="dim" style={{ margin: "0 0 12px", color: "#6b7280" }}>
                    Raw attempt logs are kept for <strong>21 days</strong> by default (configurable in class settings).
                </p>
                <p style={{ margin: "0 0 8px" }}>
                    Type <code>{token}</code> to confirm.
                </p>
                <input className={styles.input} placeholder={token} value={value} onChange={(e) => onChange?.(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
                    <button className={styles.btnDanger} onClick={onConfirm}>Remove</button>
                </div>
            </div>
        </div>
    );
}

function ConfirmDeleteClassModal({ className, deleting, onCancel, onConfirm }) {
    const token = `DELETE ${className}`.toUpperCase();
    const [val, setVal] = useState("");
    return (
        <div role="dialog" aria-modal="true" aria-label="Delete class"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 50 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, width: 520, maxWidth: "95vw", border: "1px solid #e5e7eb" }}>
                <h3 style={{ margin: "0 0 6px" }}>Delete this class?</h3>
                <p style={{ margin: "0 0 10px", color: "#374151" }}>
                    This permanently removes the class, its roster and assignments. Student personal progress stays in their accounts.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                    Type <code>{token}</code> to confirm.
                </p>
                <input className={styles.input} placeholder={token} value={val} onChange={(e) => setVal(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
                    <button className={styles.btnDanger} onClick={onConfirm} disabled={deleting || val.toUpperCase() !== token}>
                        {deleting ? "Deleting…" : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const th = { textAlign: "left", padding: "10px 12px", fontWeight: 600 };
const thMini = { textAlign: "center", padding: "6px 12px", fontWeight: 600, fontSize: 12 };
const td = { padding: "10px 12px", verticalAlign: "top" };
const tdCenter = { padding: "10px 12px", textAlign: "center", verticalAlign: "top" };

function typeLabel(t) { if (t === "BOOK") return "Book"; if (t === "QUIZ") return "Quiz"; if (t === "UPLOAD") return "Upload"; return t || "—"; }
function fmtMaybe(iso) {
    if (!iso) return "—";
    try { const d = new Date(iso); return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d); }
    catch { return iso; }
}
function fmtMaybeDT(iso) {
    if (!iso) return "—";
    try { const d = new Date(iso); return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d); }
    catch { return iso; }
}
function demoRows() {
    const now = Date.now();
    return [
        { id: 5001, title: "Chapter 3 Reading", type: "BOOK", startAt: new Date(now - 2 * 864e5).toISOString(), dueDate: new Date(now + 5 * 864e5).toISOString(), targetedCount: 3, counts: { ASSIGNED: 1, SUBMITTED: 1, GRADED: 1, LATE: 0, MISSING: 0 } },
        { id: 5002, title: "Verb Tenses — Quiz A", type: "QUIZ", startAt: new Date(now - 1 * 864e5).toISOString(), dueDate: new Date(now + 2 * 864e5).toISOString(), targetedCount: 3, counts: { ASSIGNED: 2, SUBMITTED: 1, GRADED: 0, LATE: 0, MISSING: 0 } },
        { id: 5003, title: "Upload: “The Moon Landing”", type: "UPLOAD", startAt: "", dueDate: "", targetedCount: 2, counts: { ASSIGNED: 2, SUBMITTED: 0, GRADED: 0, LATE: 0, MISSING: 0 } },
    ];
}
function toast(msg, danger = false) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: danger ? "#991b1b" : "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999 });
    document.body.appendChild(el);
    setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1200);
}

function ClassAssignmentsList({ classId }) {
    const [items, setItems] = useState([]);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/assignments/me?days=30`, { cache: "no-store" });
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed");
                if (!dead) setItems(j.data || []);
            } catch (e) {
                if (!dead) setErr(e.message || "Failed");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, [classId]);

    const dueSoon = items.filter(i => i.bucket === "DUE_SOON");
    const missing = items.filter(i => i.bucket === "MISSING");

    if (loading) return <p className={styles.dim}>Loading…</p>;
    if (err) return <p className={styles.dim}>{err}</p>;

    const Row = ({ i }) => (
        <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "8px 12px" }}><strong>{i.title}</strong></td>
            <td style={{ padding: "8px 12px" }}>{i.type}</td>
            <td style={{ padding: "8px 12px" }}>{fmtMaybeDT(i.dueDate)}</td>
            <td style={{ padding: "8px 12px" }}>
                <a className={styles.btnSecondary} href={`/assignments/${i.assignmentId}/me`}>Open</a>
            </td>
        </tr>
    );

    return (
        <div className={styles.card} style={{ padding: 0, marginTop: 8 }}>
            <div style={{ padding: 10 }}>
                <h4 className={styles.h4} style={{ marginTop: 0 }}>Due soon</h4>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Title</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Type</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Due</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dueSoon.map(i => <Row key={`d${i.assignmentId}`} i={i} />)}
                            {dueSoon.length === 0 && (
                                <tr><td colSpan={4} className={styles.dim} style={{ padding: 12 }}>No upcoming work.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <h4 className={styles.h4} style={{ margin: "12px 0 0" }}>Missing</h4>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Title</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Type</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Due</th>
                                <th style={{ textAlign: "left", padding: "8px 12px" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {missing.map(i => <Row key={`m${i.assignmentId}`} i={i} />)}
                            {missing.length === 0 && (
                                <tr><td colSpan={4} className={styles.dim} style={{ padding: 12 }}>Nothing missing 🎉</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
