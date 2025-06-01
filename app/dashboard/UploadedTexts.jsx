"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function UploadedTexts() {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/uploadedtext")
      .then((res) => res.json())
      .then(setTexts)
      .catch(() => setError("Failed to load uploaded texts"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id) {
    const confirmed = confirm("Are you sure you want to delete this text?");
    if (!confirmed) return;

    const res = await fetch("/api/uploadedtext", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setTexts((prev) => prev.filter((t) => t.id !== id));
    } else {
      alert("Failed to delete text.");
    }
  }

  if (loading) return <p>📂 Loading uploaded texts...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <section className="dashboard-section">
      <h3>📂 Uploaded Texts</h3>
      {texts.length === 0 ? (
        <p style={{ color: "#666" }}>No uploads yet.</p>
      ) : (
        <ul className="upload-list">
          {texts.map((text) => (
            <li key={text.id} className="upload-row">
              <Link href={`/uploads/${text.id}`}>
                <strong>{text.title}</strong>
              </Link>
              <span style={{ fontSize: "0.85rem", marginLeft: "1rem" }}>
                Created {new Date(text.createdAt).toLocaleDateString()}
                {text.viewedAt && (
                  <> • Last viewed {new Date(text.viewedAt).toLocaleDateString()}</>
                )}
                {text.locked && <> 🔒</>}
              </span>
              <button
                onClick={() => handleDelete(text.id)}
                className="delete-button"
                style={{ marginLeft: "1rem", fontSize: "0.8rem" }}
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: "1rem" }}>
        <Link href="/uploads/new" className="cta-button">
          + Upload New Text
        </Link>
      </div>
    </section>
  );
}
