"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
    const [pass, setPass] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const sp = useSearchParams();

    async function submit(e) {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            const r = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pass }),
                credentials: "include",
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Login failed");
            const next = sp.get("next");
            const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin/support";
            window.location.href = dest;
        } catch (e) {
            setErr(e.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main style={{ maxWidth: 480, margin: "24px auto", padding: 16 }}>
            <h1>Admin Login</h1>
            <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <input
                    type="password"
                    placeholder="Admin password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 8 }}
                />
                {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
                <button disabled={!pass || loading} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff" }}>
                    {loading ? "Logging in…" : "Login"}
                </button>
            </form>
        </main>
    );
}
