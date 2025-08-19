"use client";

import { useEffect, useState } from "react";
import Navbar from "../Navbar";

export default function SignupPage() {
    const [code, setCode] = useState("");
    const [created, setCreated] = useState(false);
    const [err, setErr] = useState("");

    async function create() {
        setErr("");
        try {
            const r = await fetch("/api/session/new", { method: "POST" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Could not create code");
            setCode(j.data.shortCode);
            setCreated(true);
        } catch (e) {
            setErr(e.message || "Failed to create code");
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            alert("Code copied!");
        } catch { }
    }

    useEffect(() => { if (!created) create(); }, []); // auto-create on first load

    return (
        <>
            <Navbar />
            <main style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
                <h1>Create your progress code</h1>
                <p style={{ color: "#6b7280" }}>
                    This code is your identity. Keep it safe; you can use it to log in on any device.
                </p>

                {err && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{err}</div>}

                {created ? (
                    <div style={{
                        display: "grid", gap: 10, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb"
                    }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{code || "—"}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={copy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #c9d7fb", background: "#e9eefc", color: "#0b3b9f" }}>
                                Copy code
                            </button>
                            <a href="/dashboard" style={{ padding: "8px 12px", borderRadius: 8, background: "#3b82f6", color: "#fff", textDecoration: "none" }}>
                                Go to dashboard
                            </a>
                        </div>
                    </div>
                ) : (
                    <div style={{ color: "#6b7280" }}>Creating your code…</div>
                )}
            </main>
        </>
    );
}
