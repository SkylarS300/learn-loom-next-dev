"use client";

import { useEffect, useState } from "react";

export default function CodeLoginCard() {
    const [me, setMe] = useState({ ok: false, anonId: null, shortCode: null, loading: true });
    const [code, setCode] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    // load current session (if any)
    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/session/me", { cache: "no-store" });
                const j = await r.json();
                if (!dead) setMe({ ok: !!j?.ok, anonId: j?.data?.anonId ?? null, shortCode: j?.data?.shortCode ?? null, loading: false });
            } catch {
                if (!dead) setMe({ ok: false, anonId: null, shortCode: null, loading: false });
            }
        })();
        return () => { dead = true; };
    }, []);

    async function login(e) {
        e?.preventDefault();
        setErr(""); setBusy(true);
        try {
            const r = await fetch("/api/session/code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Invalid code");
            // hard refresh so all server components see the cookie
            window.location.reload();
        } catch (e) {
            setErr(e.message || "Login failed");
        } finally {
            setBusy(false);
        }
    }

    if (me.loading) {
        return <div style={cardStyle}><div style={{ color: "#6b7280" }}>Loading…</div></div>;
    }

    // Already logged in -> show their code
    if (me.ok && me.anonId) {
        return (
            <div style={cardStyle}>
                <h3 style={{ margin: 0 }}>Your progress code</h3>
                <p style={{ color: "#6b7280", margin: "6px 0 10px" }}>Use this to sign in on any device.</p>
                <div style={pill}>{me.shortCode || "—"}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(me.shortCode || ""); toast("Copied"); } catch { } }}
                        style={btnSecondary}>Copy</button>
                    <a href="/signup" style={btnPrimary}>Get a new code</a>
                </div>
            </div>
        );
    }

    // Logged out -> show simple sign-in form
    return (
        <div style={cardStyle}>
            <h3 style={{ margin: 0 }}>Enter your progress code</h3>
            <p style={{ color: "#6b7280", margin: "6px 0 10px" }}>Example: <code>AB12-XY34-9K</code></p>
            <form onSubmit={login} style={{ display: "grid", gap: 8 }}>
                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste your code"
                    aria-label="Progress code"
                    style={input}
                />
                {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={!code.trim() || busy} type="submit" style={btnPrimary}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                    <a href="/signup" style={btnSecondary}>Get a code</a>
                </div>
            </form>
        </div>
    );
}

// inline styles (keep it simple)
const cardStyle = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
const input = { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 };
const btnPrimary = { background: "#3b82f6", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, textDecoration: "none", cursor: "pointer" };
const btnSecondary = { background: "#e9eefc", color: "#0b3b9f", border: "1px solid #c9d7fb", padding: "8px 12px", borderRadius: 8, textDecoration: "none", cursor: "pointer" };
const pill = { display: "inline-block", border: "1px solid #d1d5db", borderRadius: 999, padding: "6px 12px", fontWeight: 600 };

function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999 });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}
