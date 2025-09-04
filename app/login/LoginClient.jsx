'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../Navbar";

export default function LoginClient() {
    const [code, setCode] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [autoTried, setAutoTried] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Prefill from QR deep-link (?code=AB12-XY34-9K)
    useEffect(() => {
        const pre = searchParams.get("code");
        if (pre) setCode(pre.trim());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    // Auto-submit once if code came from URL and looks non-empty
    useEffect(() => {
        const pre = searchParams.get("code");
        if (!pre) return;
        if (autoTried) return;
        if (!code.trim()) return; // wait until state is set
        setAutoTried(true);
        submit(); // call without event
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    async function submit(e) {
        if (e) e.preventDefault();
        setErr(""); setLoading(true);
        try {
            const r = await fetch("/api/session/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ code }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Invalid code");

            // Rely on server-set cookie from the API response.
            // Redirect to ?next= if valid, else /dashboard
            const next = searchParams.get("next");
            const validNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
            // full navigation so middleware evaluates cookie
            window.location.href = validNext;
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
                <p style={{ color: "#6b7280" }}>
                    Paste your short code (e.g., <code>AB12-XY34-9K</code>), or scan a QR from another device.
                </p>
                <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Your code"
                        aria-label="Your code"
                        style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
                    />
                    {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
                    <button
                        disabled={!code.trim() || loading}
                        style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: "none",
                            background: "#3b82f6",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        {loading ? "Logging in…" : "Log in"}
                    </button>
                </form>
            </main>
        </>
    );
}
