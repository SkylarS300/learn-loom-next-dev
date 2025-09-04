"use client";
import { useEffect } from "react";

export default function LogoutClient() {
    useEffect(() => {
        (async () => {
            try { await fetch("/api/admin/logout", { method: "POST" }); } catch { }
            window.location.href = "/admin/login";
        })();
    }, []);
    return <main style={{ maxWidth: 480, margin: "24px auto", padding: 16 }}>Logging out…</main>;
}
