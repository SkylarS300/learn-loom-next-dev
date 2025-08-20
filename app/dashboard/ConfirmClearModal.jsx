"use client";

import { useEffect, useRef } from "react";

export default function ConfirmClearModal({ open, onClose, onConfirm }) {
    const firstBtnRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        // focus first interactive element
        firstBtnRef.current?.focus();
        // ESC to close
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            style={backdrop}
        >
            <div style={card}>
                <h3 id="clear-title" style={{ marginTop: 0, marginBottom: 8 }}>Clear my traces?</h3>
                <p style={{ marginTop: 0, color: "#374151" }}>
                    This permanently deletes your reading, grammar, uploads, notes, and codes tied to this browser’s anonymous ID.
                    If you want a copy first, export everything as a ZIP.
                </p>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                    <a
                        ref={firstBtnRef}
                        href="/api/export?kind=all"
                        download="all_exports.zip"
                        style={btnSecondary}
                    >
                        ⬇️ Export All (ZIP)
                    </a>
                    <div style={{ flex: 1 }} />
                    <button onClick={onClose} style={btnNeutral}>Cancel</button>
                    <button
                        onClick={async () => { await onConfirm?.(); }}
                        style={btnDanger}
                    >
                        Yes, clear everything
                    </button>
                </div>
            </div>
        </div>
    );
}

/* inline styles */
const backdrop = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
};

const card = {
    width: "min(560px, 92vw)",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
};

const baseBtn = {
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
    border: "1px solid transparent",
    textDecoration: "none",
    fontSize: 14,
};

const btnSecondary = {
    ...baseBtn,
    background: "#eef2ff",
    color: "#1e3a8a",
    borderColor: "#c7d2fe",
};

const btnNeutral = {
    ...baseBtn,
    background: "#f3f4f6",
    color: "#111827",
    borderColor: "#e5e7eb",
};

const btnDanger = {
    ...baseBtn,
    background: "#ef4444",
    color: "#fff",
    borderColor: "#ef4444",
};
