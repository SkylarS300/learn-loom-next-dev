"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../Navbar";

export default function LoginPage() {
    const [code, setCode] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function submit(e) {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            const r = await fetch("/api/session/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Invalid code");
            router.push("/dashboard");
        } catch (e) {
            setErr(e.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Navbar />
            <main style={{ maxWidth: 520, margin: "24px auto", padding: 16 }}>
                <h1>Log in with your code</h1>
                <p style={{ color: "#6b7280" }}>Paste your short code (e.g., <code>AB12-XY34-9K</code>).</p>
                <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Your code"
                        aria-label="Your code"
                        style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
                    />
                    {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
                    <button
                        disabled={!code.trim() || loading}
                        style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer" }}
                    >
                        {loading ? "Logging in…" : "Log in"}
                    </button>
                </form>
            </main>
        </>
    );
}
