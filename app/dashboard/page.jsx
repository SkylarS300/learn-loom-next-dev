"use client";

import { useEffect, useState } from "react";
import books from "@/src/content/book-content.js";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/quickresume");
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Failed");
        setData(j.data);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  const reading = data?.reading;
  const upload = data?.upload;
  const grammar = data?.grammar;

  function titleForBookIndex(idx) {
    if (idx == null) return null;
    return books?.[idx]?.title || `Book #${idx}`;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
      <h1>Dashboard</h1>
      {err && <p style={{ color: "red" }}>{err}</p>}

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginTop: 16,
        }}
      >
        {/* Quick Resume: Reading */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>📖 Reading</h3>
          {reading ? (
            <>
              <p>
                <strong>{titleForBookIndex(reading.bookIndex)}</strong>, Chapter{" "}
                {reading.chapterIndex}
                {Number.isInteger(reading.sentenceIndex)
                  ? `, Sentence ${reading.sentenceIndex}`
                  : ""}
              </p>
              <button
                onClick={() =>
                  (window.location.href = `/readingpal?bookIndex=${reading.bookIndex}`)
                }
                style={btnStyle}
              >
                Resume Reading
              </button>
            </>
          ) : (
            <p>No recent book progress.</p>
          )}
        </div>

        {/* Quick Resume: Upload */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>📤 Upload</h3>
          {upload ? (
            <>
              <p>
                Upload #{upload.uploadId}
                {Number.isInteger(upload.paraIndex)
                  ? `, Paragraph ${upload.paraIndex}`
                  : ""}
              </p>
              <button
                onClick={() => (window.location.href = `/uploads/${upload.uploadId}`)}
                style={btnStyle}
              >
                Resume Upload
              </button>
            </>
          ) : (
            <p>No recent upload reading.</p>
          )}
        </div>

        {/* Quick Resume: Grammar */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>🧠 Grammar</h3>
          {grammar ? (
            <>
              <p>
                Last practiced: <strong>{grammar.concept}</strong>
                {grammar.subTopic ? ` — ${grammar.subTopic}` : ""}
              </p>
              <button
                onClick={() => (window.location.href = `/grammar`)}
                style={btnStyle}
              >
                Practice More
              </button>
            </>
          ) : (
            <p>No recent grammar practice.</p>
          )}
        </div>
      </section>

      {/* Export Data */}
      <section style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>⬇️ Export Data</h3>
        <p style={{ color: "#555", marginTop: 4, marginBottom: 12 }}>
          Exports include only your anonymous activity tied to your browser’s cookie.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a
            href="/api/export?kind=reading"
            download="reading.csv"
            style={btnStyle}
          >
            Reading CSV
          </a>
          <a
            href="/api/export?kind=grammar"
            download="grammar.csv"
            style={btnStyle}
          >
            Grammar CSV
          </a>
          <a
            href="/api/export?kind=uploads"
            download="uploads.csv"
            style={btnStyle}
          >
            Uploads CSV
          </a>
          <a
            href="/api/export?kind=all"
            download="all_exports.zip"
            style={btnStyleSecondary}
          >
            All (ZIP)
          </a>
        </div>
      </section>
    </main>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const btnStyleBase = {
  display: "inline-block",
  textDecoration: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnStyle = {
  ...btnStyleBase,
  background: "#0070f3",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
};

const btnStyleSecondary = {
  ...btnStyleBase,
  background: "#e9eefc",
  color: "#0b3b9f",
  border: "1px solid #c9d7fb",
  padding: "8px 12px",
};
