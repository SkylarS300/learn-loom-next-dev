"use client";
import { useEffect, useRef } from "react";
import QRCode from "react-qr-code";

export default function CodeModal({ open, shortCode, onClose }) {
    const backdropRef = useRef(null);
    const qrRef = useRef(null);

    useEffect(() => {
        function onKey(e) { if (e.key === "Escape") onClose?.(); }
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const link = typeof window !== "undefined"
        ? `${window.location.origin}/login?code=${encodeURIComponent(shortCode || "")}`
        : `https://learnloom.app/login?code=${encodeURIComponent(shortCode || "")}`;

    async function copy(text) {
        try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { }
    }

    function downloadPng() {
        // Convert QR SVG to PNG for download
        const svg = qrRef.current?.querySelector("svg");
        if (!svg) return;
        const xml = new XMLSerializer().serializeToString(svg);
        const svg64 = btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const size = 768; // crisp export
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, size, size);
            const a = document.createElement("a");
            a.download = `learnloom-code-${shortCode}.png`;
            a.href = canvas.toDataURL("image/png");
            a.click();
        };
        img.src = `data:image/svg+xml;base64,${svg64}`;
    }

    return (
        <div
            role="dialog" aria-modal="true" aria-label="Your LearnLoom code"
            ref={backdropRef}
            onClick={(e) => { if (e.target === backdropRef.current) onClose?.(); }}
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
            }}
        >
            <div style={{
                width: "min(520px, 96vw)", background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 12, boxShadow: "0 16px 28px rgba(0,0,0,.18)", padding: 16
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, flex: 1 }}>Your progress code</h3>
                    <button onClick={onClose} style={btn}>Close</button>
                </div>

                <p style={{ marginTop: 8, color: "#4b5563" }}>
                    Scan this on another device or paste the code to log in.
                </p>

                <div ref={qrRef} style={{ display: "grid", placeItems: "center", padding: 12 }}>
                    <div style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
                        <QRCode value={link} size={224} />
                    </div>
                    <code style={{
                        marginTop: 10, fontWeight: 700, border: "1px solid #e5e7eb",
                        padding: "8px 12px", borderRadius: 999
                    }}>{shortCode || "—"}</code>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => copy(shortCode)} style={btn}>Copy code</button>
                    <button onClick={() => copy(link)} style={btn}>Copy link</button>
                    <button onClick={downloadPng} style={btnPrimary}>Download QR</button>
                </div>
            </div>
        </div>
    );
}

const btn = {
    background: "#e9eefc", color: "#0b3b9f", border: "1px solid #c9d7fb",
    padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13
};
const btnPrimary = {
    background: "#3b82f6", color: "#fff", border: "none",
    padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13
};

function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, zIndex: 9999
    });
    document.body.appendChild(el); setTimeout(() => el.remove(), 1100);
}
