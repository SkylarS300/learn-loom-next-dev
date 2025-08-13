"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function UploadsPage() {
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchUploads();
    }, []);

    async function fetchUploads() {
        setLoading(true);
        const res = await fetch("/api/uploadedtext");
        if (res.ok) {
            const data = await res.json();
            setUploads(data);
        } else {
            setError("Failed to fetch uploads.");
        }
        setLoading(false);
    }

    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this upload?")) return;

        setDeletingId(id);
        const res = await fetch("/api/uploadedtext", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });

        if (res.ok) {
            setUploads((prev) => prev.filter((u) => u.id !== id));
        } else {
            setError("Failed to delete upload.");
        }

        setDeletingId(null);
    }

    return (
        <section className="upload-dashboard" style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
            <h1>📤 My Uploads</h1>
            {error && <p style={{ color: "red" }}>{error}</p>}
            {loading ? (
                <p>Loading uploads...</p>
            ) : uploads.length === 0 ? (
                <div style={{ textAlign: "center", marginTop: "2rem", color: "#666" }}>
                    <p style={{ fontSize: "1.1rem" }}>You haven’t uploaded anything yet.</p>
                    <Link href="/uploads/new">
                        <button className="cta-button" style={{ marginTop: "1rem" }}>
                            Upload Something →
                        </button>
                    </Link>
                </div>
            ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {uploads.map((upload) => (
                        <li
                            key={upload.id}
                            style={{
                                padding: "1rem",
                                marginBottom: "1rem",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <strong>{upload.title}</strong> {upload.locked && "🔒"}
                                    <br />
                                    <span style={{ fontSize: "0.85rem", color: "#666" }}>
                                        Uploaded {new Date(upload.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <Link href={`/uploads/${upload.id}`}>
                                        <button className="cta-button">Open</button>
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(upload.id)}
                                        disabled={deletingId === upload.id}
                                        style={{
                                            background: "#f44336",
                                            color: "white",
                                            border: "none",
                                            padding: "0.5rem 1rem",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {deletingId === upload.id ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
