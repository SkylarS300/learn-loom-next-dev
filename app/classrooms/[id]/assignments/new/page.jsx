// app/classrooms/[id]/assignments/new/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../../../Navbar";
import styles from "../../../../dashboard/Dashboard.module.css";

const TYPES = ["BOOK", "QUIZ", "UPLOAD"];

export default function NewAssignmentPage() {
    const { id } = useParams();
    const classId = Number(id);
    const router = useRouter();
    const q = useSearchParams();
    const demoTargets = q.get("demoTargets") === "1";

    const [step, setStep] = useState(1);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    // form state
    const [type, setType] = useState("BOOK");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    // type specifics
    const [bookId, setBookId] = useState("");
    const [chapterIndex, setChapterIndex] = useState("");
    const [category, setCategory] = useState("");
    const [subtopic, setSubtopic] = useState("");
    const [uploadId, setUploadId] = useState("");

    // schedule/weight
    const [startDate, setStartDate] = useState(""); // yyyy-mm-dd
    const [startTime, setStartTime] = useState(""); // hh:mm
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [allowLate, setAllowLate] = useState(true);
    const [latePenaltyPct, setLatePenaltyPct] = useState("");
    const [weightPoints, setWeightPoints] = useState("");

    // targeting
    const [targetsMode, setTargetsMode] = useState("ALL"); // "ALL" | "SELECTED"
    const [roster, setRoster] = useState([]);
    const [selected, setSelected] = useState(new Set());

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch(`/api/classrooms/${classId}/roster`, { cache: "no-store" });
                if (r.status === 403 && demoTargets) {
                    if (!dead) {
                        setRoster(demoRoster());
                    }
                    return;
                }
                const j = await r.json();
                if (!j?.ok) throw new Error(j?.error || "Failed to load roster");
                if (!dead) setRoster(j.data || []);
            } catch (e) {
                if (demoTargets && !dead) {
                    setRoster(demoRoster());
                } else {
                    setErr(e.message || "Failed to load roster");
                }
            }
        })();
        return () => { dead = true; };
    }, [classId, demoTargets]);

    // sensible default title when empty
    useEffect(() => {
        if (!title) {
            if (type === "BOOK") setTitle("Reading assignment");
            else if (type === "QUIZ") setTitle("Grammar quiz");
            else setTitle("Upload reading");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    const selectedArray = useMemo(() => Array.from(selected), [selected]);

    function combineDateTime(d, t) {
        if (!d) return null;
        const iso = t ? `${d}T${t}:00` : `${d}T00:00:00`;
        const dt = new Date(iso);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }

    function toggleSelect(anonId) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(anonId)) next.delete(anonId);
            else next.add(anonId);
            return next;
        });
    }

    function validateStep() {
        if (step === 1) {
            if (!TYPES.includes(type)) return "Pick a type";
        }
        if (step === 2) {
            if (!title.trim()) return "Title is required";
            if (type === "BOOK" && (bookId === "" || chapterIndex === "")) return "Book and chapter are required";
            if (type === "QUIZ" && !category.trim()) return "Quiz category is required";
            if (type === "UPLOAD" && uploadId === "") return "Upload ID is required";
        }
        if (step === 3) {
            // no hard requirements; due/start optional
        }
        if (step === 4) {
            if (targetsMode === "SELECTED" && selectedArray.length === 0) return "Select at least one student or choose Everyone";
        }
        return "";
    }

    async function onCreate() {
        const v = validateStep();
        if (v) { setErr(v); return; }
        setErr("");
        setLoading(true);
        try {
            const body = {
                title: title.trim(),
                description,
                type,
                startAt: combineDateTime(startDate, startTime),
                dueDate: combineDateTime(dueDate, dueTime),
                allowLate,
                latePenaltyPct: latePenaltyPct !== "" ? Number(latePenaltyPct) : null,
                weightPoints: weightPoints !== "" ? Number(weightPoints) : null,
                category: type === "QUIZ" ? category || null : null,
                subtopic: type === "QUIZ" ? subtopic || null : null,
                bookId: type === "BOOK" ? (bookId === "" ? null : Number(bookId)) : null,
                chapterIndex: type === "BOOK" ? (chapterIndex === "" ? null : Number(chapterIndex)) : null,
                uploadId: type === "UPLOAD" ? (uploadId === "" ? null : Number(uploadId)) : null,
                targets: targetsMode === "ALL" ? "ALL" : selectedArray,
            };

            const r = await fetch(`/api/classrooms/${classId}/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to create");
            toast("Assignment created");
            // Navigate straight to the new assignment's detail table
            const newId = j?.data?.assignmentId;
            router.push(newId ? `/assignments/${newId}` : `/classrooms/${classId}`);
            router.push(`/classrooms/${classId}`);
        } catch (e) {
            setErr(e.message || "Failed to create");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Navbar />
            <main className={styles.main}>
                <a href={`/classrooms/${classId}`} className={styles.btnSecondary}>← Back</a>
                <h1 style={{ marginTop: 8 }}>New assignment</h1>
                {demoTargets && (
                    <p className={styles.dim} style={{ marginTop: 4 }}>
                        Demo roster enabled (<code>?demoTargets=1</code>)
                    </p>
                )}
                {err && <p style={{ color: "#b91c1c" }}>{err}</p>}

                <WizardNav step={step} setStep={setStep} />

                {step === 1 && (
                    <section className={styles.card} style={{ marginTop: 12 }}>
                        <h4 className={styles.h4}>1) Type</h4>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {TYPES.map((t) => (
                                <button
                                    key={t}
                                    className={type === t ? styles.btn : styles.btnSecondary}
                                    onClick={() => setType(t)}
                                    aria-pressed={type === t}
                                >
                                    {prettyType(t)}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className={styles.card} style={{ marginTop: 12 }}>
                        <h4 className={styles.h4}>2) Details</h4>
                        <div className={styles.editWrap}>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Title</label>
                                <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Description</label>
                                <input className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>

                            {type === "BOOK" && (
                                <>
                                    <div className={styles.editRow}>
                                        <label style={{ width: 120 }}>Book index</label>
                                        <input className={styles.input} type="number" value={bookId} onChange={(e) => setBookId(e.target.value)} />
                                    </div>
                                    <div className={styles.editRow}>
                                        <label style={{ width: 120 }}>Chapter</label>
                                        <input className={styles.input} type="number" value={chapterIndex} onChange={(e) => setChapterIndex(e.target.value)} />
                                    </div>
                                </>
                            )}

                            {type === "QUIZ" && (
                                <>
                                    <div className={styles.editRow}>
                                        <label style={{ width: 120 }}>Category</label>
                                        <input className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., verbs" />
                                    </div>
                                    <div className={styles.editRow}>
                                        <label style={{ width: 120 }}>Subtopic</label>
                                        <input className={styles.input} value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="e.g., past" />
                                    </div>
                                </>
                            )}

                            {type === "UPLOAD" && (
                                <div className={styles.editRow}>
                                    <label style={{ width: 120 }}>Upload ID</label>
                                    <input className={styles.input} type="number" value={uploadId} onChange={(e) => setUploadId(e.target.value)} />
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {step === 3 && (
                    <section className={styles.card} style={{ marginTop: 12 }}>
                        <h4 className={styles.h4}>3) Schedule, late policy & weight</h4>
                        <div className={styles.editWrap}>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Start date</label>
                                <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <input className={styles.input} style={{ maxWidth: 140 }} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Due date</label>
                                <input className={styles.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                <input className={styles.input} style={{ maxWidth: 140 }} type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                            </div>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Allow late</label>
                                <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
                            </div>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Late penalty %</label>
                                <input className={styles.input} type="number" placeholder="e.g., 10" value={latePenaltyPct} onChange={(e) => setLatePenaltyPct(e.target.value)} />
                            </div>
                            <div className={styles.editRow}>
                                <label style={{ width: 120 }}>Weight (points)</label>
                                <input className={styles.input} type="number" placeholder="e.g., 20" value={weightPoints} onChange={(e) => setWeightPoints(e.target.value)} />
                            </div>
                        </div>
                    </section>
                )}

                {step === 4 && (
                    <section className={styles.card} style={{ marginTop: 12 }}>
                        <h4 className={styles.h4}>4) Targeting</h4>
                        <div className={styles.editRow} style={{ marginBottom: 8 }}>
                            <label><input type="radio" name="targets" checked={targetsMode === "ALL"} onChange={() => setTargetsMode("ALL")} /> Everyone in class</label>
                            <label style={{ marginLeft: 16 }}><input type="radio" name="targets" checked={targetsMode === "SELECTED"} onChange={() => setTargetsMode("SELECTED")} /> Selected students</label>
                        </div>
                        {targetsMode === "SELECTED" && (
                            <div style={{ display: "grid", gap: 6 }}>
                                {roster.filter(r => (r.role || "student") !== "teacher").map((r) => (
                                    <label key={r.anonId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(r.anonId)}
                                            onChange={() => toggleSelect(r.anonId)}
                                        />
                                        <span><strong>{r.displayName || r.anonId.slice(0, 8) + "…"}</strong> <span className={styles.dim}>({r.anonId})</span></span>
                                    </label>
                                ))}
                                {!roster.length && <p className={styles.dim}>No roster yet.</p>}
                            </div>
                        )}
                    </section>
                )}

                {step === 5 && (
                    <section className={styles.card} style={{ marginTop: 12 }}>
                        <h4 className={styles.h4}>5) Review</h4>
                        <ul className={styles.listReset} style={{ lineHeight: 1.8 }}>
                            <li><strong>Type:</strong> {prettyType(type)}</li>
                            <li><strong>Title:</strong> {title || "—"}</li>
                            <li><strong>Description:</strong> {description || "—"}</li>
                            {type === "BOOK" && <li><strong>Book/Chapter:</strong> {bookId || "—"} / {chapterIndex || "—"}</li>}
                            {type === "QUIZ" && <li><strong>Category/Subtopic:</strong> {category || "—"} / {subtopic || "—"}</li>}
                            {type === "UPLOAD" && <li><strong>Upload ID:</strong> {uploadId || "—"}</li>}
                            <li><strong>Start:</strong> {fmtDT(startDate, startTime)}</li>
                            <li><strong>Due:</strong> {fmtDT(dueDate, dueTime)}</li>
                            <li><strong>Allow late:</strong> {allowLate ? "Yes" : "No"}</li>
                            <li><strong>Late penalty %:</strong> {latePenaltyPct || "—"}</li>
                            <li><strong>Weight (points):</strong> {weightPoints || "—"}</li>
                            <li><strong>Targets:</strong> {targetsMode === "ALL" ? "Everyone" : `${selectedArray.length} selected`}</li>
                        </ul>
                    </section>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1 || loading}
                    >
                        Back
                    </button>
                    {step < 5 ? (
                        <button
                            className={styles.btn}
                            onClick={() => {
                                const v = validateStep();
                                if (v) { setErr(v); return; }
                                setStep(step + 1);
                            }}
                            disabled={loading}
                        >
                            Next
                        </button>
                    ) : (
                        <button className={styles.btn} onClick={onCreate} disabled={loading}>
                            {loading ? "Creating…" : "Create assignment"}
                        </button>
                    )}
                </div>
            </main>
        </>
    );
}

function WizardNav({ step, setStep }) {
    const steps = ["Type", "Details", "Schedule", "Targeting", "Review"];
    return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {steps.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                return (
                    <button
                        key={label}
                        className={active ? "btnActive" : "btn"}
                        onClick={() => setStep(n)}
                        style={{
                            border: "1px solid #e5e7eb",
                            background: active ? "#e9eefc" : "#f9fafb",
                            color: active ? "#0b3b9f" : "#111827",
                            borderRadius: 999,
                            padding: "6px 10px",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                        aria-pressed={active}
                    >
                        {n}. {label}
                    </button>
                );
            })}
        </div>
    );
}

function prettyType(t) {
    if (t === "BOOK") return "Book";
    if (t === "QUIZ") return "Quiz";
    if (t === "UPLOAD") return "Upload";
    return t;
}

function fmtDT(d, t) {
    if (!d) return "—";
    return t ? `${d} ${t}` : d;
}

function demoRoster() {
    return [
        { anonId: "anon_ALEX_01", role: "student", displayName: "Alex" },
        { anonId: "anon_BLAIR_02", role: "student", displayName: "Blair" },
        { anonId: "anon_CASEY_03", role: "student", displayName: "Casey" },
    ];
}

function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}
