"use client";
export default function Error({ error }) {
    return <div style={{ padding: 16, color: "#c0392b" }}>Failed to load uploads: {error?.message || "Error"}</div>;
}
