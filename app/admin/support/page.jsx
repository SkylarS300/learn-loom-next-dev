"use client";

import { useState } from "react";

export default function SupportPage() {
    const [pass, setPass] = useState("");
    const [code, setCode] = useState("");
    const [anon, setAnon] = useState("");
    const [result, setResult] = useState(null);
    const [err, setErr] = useState("");

    async function lookup() {
        setErr(""); setResult(null);
        const sp = new URLSearchParams();
        if (code.trim()) sp.set("code", code.trim());
        if (anon.trim()) sp.set("anonId", anon.trim());
        try {
            const r = await fetch(`/api/admin/user?${sp.toString()}`, {
                headers: { "x-support-pass": pass },
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Lookup failed");
            setResult(j.data);
        } catch (e) {
            setErr(e.message || "Lookup failed");
        }
    }

    return (
        <main style={{ maxWidth: 800, margin: "24px auto", padding: 16 }}>
            <h1>Support Lookup</h1>
            <p style={{ color: "#6b7280" }}>Enter support password and either a short code or anonId.</p>

            <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
                <input placeholder="Support password" type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                    style={inp} />
                <input placeholder="Short code (e.g., ABCD-EFGH-123)" value={code} onChange={(e) => setCode(e.target.value)}
                    style={inp} />
                <div style={{ textAlign: "center" }}>— or —</div>
                <input placeholder="anonId" value={anon} onChange={(e) => setAnon(e.target.value)} style={inp} />
                <button onClick={lookup} style={btn}>Lookup</button>
                {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
            </div>

            {result && (
                <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div><strong>anonId:</strong> {result.anonId}</div>
                    <div style={{ marginTop: 8 }}>
                        <strong>Short codes:</strong>
                        <ul>
                            {result.shortCodes?.map((c, i) => (
                                <li key={i}>{c.shortCode} <span style={{ color: "#6b7280" }}>· created {new Date(c.createdAt).toLocaleString()}</span></li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <strong>Classes:</strong>
                        <ul>
                            {result.classes?.map((c, i) => (
                                <li key={i}>Classroom #{c.classroomId} · role: {c.role}{c.displayName ? ` · as ${c.displayName}` : ""}</li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ marginTop: 8 }}><strong>Notes:</strong> {result.notesCount}</div>

                    <div style={{ marginTop: 8 }}>
                        <strong>Recent grammar:</strong>
                        <ul>
                            {result.recentGrammar?.map((g, i) => (
                                <li key={i}>{g.concept}/{g.subTopic} · score {g.score} · {new Date(g.createdAt).toLocaleString()}</li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <strong>Recent reading:</strong>
                        <ul>
                            {result.recentReading?.map((r, i) => (
                                <li key={i}>Book {r.bookIndex}, Chapter {r.chapterIndex} · {new Date(r.updatedAt).toLocaleString()}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </main>
    );
}

const inp = { padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 };
const btn = { padding: "10px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", width: 140 };
