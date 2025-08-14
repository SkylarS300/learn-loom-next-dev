"use client";

import { useEffect, useState } from "react";
import books from "@/src/content/book-content.js";
import {
  ResponsiveContainer,
  LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [rangeDays, setRangeDays] = useState(7);
  const [metrics, setMetrics] = useState({
    readingDaily: [],
    grammarDaily: [],
    grammarPaceDaily: [],
    topWeakAreas: [],
  });

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

  // fetch charts
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/metrics?days=${rangeDays}`);
        const j = await r.json();
        if (j?.ok) setMetrics(j.data);
      } catch { }
    })();
  }, [rangeDays]);

  const reading = data?.reading;
  const upload = data?.upload;
  const grammar = data?.grammar;

  function titleForBookIndex(idx) {
    if (idx == null) return null;
    return books?.[idx]?.title || `Book #${idx}`;
  }

  function RecommendedChips() {
    const [rows, setRows] = useState([]);
    useEffect(() => {
      (async () => {
        try {
          const r = await fetch("/api/grammar/recommendations");
          const j = await r.json();
          if (j?.ok) setRows(j.data || []);
        } catch { }
      })();
    }, []);
    if (!rows.length) return null;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 16px" }}>
        {rows.map((r, i) => (
          <span key={i} title={`Attempts ${r.attempts} · Acc ${Math.round((r.accuracy || 0) * 100)}%`}
            style={{ border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: 999, padding: "4px 10px", fontSize: 12 }}>
            {r.concept} — {r.subTopic}
          </span>
        ))}
        {rows.map((r, i) => {
          const href = `/grammar?concept=${encodeURIComponent(r.concept)}&subTopic=${encodeURIComponent(r.subTopic)}&start=1`;
          return (
            <a
              key={i}
              href={href}
              title={`Attempts ${r.attempts} · Acc ${Math.round((r.accuracy || 0) * 100)}%`}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 12,
              }}
            >
              {r.concept} — {r.subTopic}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <RecommendedChips />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            style={{ ...btnStyle, background: "#ef4444" }}
            onClick={async () => {
              try {
                // Clear local app data
                localStorage.clear();
              } catch { }
              try {
                // Clear share-code cookie via API
                await fetch("/api/sharecode", { method: "DELETE" });
              } catch { }
              // Expire learnloomId (client-set cookie)
              document.cookie = "learnloomId=; Max-Age=0; path=/";
              // Reload to let InitAnonId.jsx set a fresh anon
              window.location.href = "/";
            }}
            aria-label="Clear my anonymous data"
          >
            Clear my traces
          </button>
        </div>
      </div>
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

      {/* Progress charts */}
      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>📈 Progress</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => setRangeDays(7)}
              style={{ ...btnStyle, background: rangeDays === 7 ? "#0070f3" : "#e9eefc", color: rangeDays === 7 ? "#fff" : "#0b3b9f" }}
            >7 days</button>
            <button
              onClick={() => setRangeDays(30)}
              style={{ ...btnStyle, background: rangeDays === 30 ? "#0070f3" : "#e9eefc", color: rangeDays === 30 ? "#fff" : "#0b3b9f" }}
            >30 days</button>
          </div>
        </div>

        {/* Reading minutes */}
        <div style={cardStyle}>
          <h4 style={{ margin: "0 0 8px" }}>Reading time (minutes / day)</h4>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={metrics.readingDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis width={40} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="minutes" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grammar average score */}
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <h4 style={{ margin: "0 0 8px" }}>Grammar average score (/ day)</h4>

          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={metrics.grammarDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis width={40} domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avg" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>


          {/* NEW: Grammar pace (sec / question) */}
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>Grammar pace (sec / question)</h4>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={metrics.grammarPaceDaily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis width={40} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="secPerQ" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NEW: Grammar insights (top weak areas) */}
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>Grammar insights</h4>
            {metrics.topWeakAreas?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {metrics.topWeakAreas.map((r, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong>{r.concept}</strong> — {r.subTopic}
                    {" · "}
                    Acc: <strong>{Math.round((r.weightedAccuracy || 0) * 100)}%</strong>
                    {" · "}
                    <button
                      onClick={() =>
                      (window.location.href =
                        `/grammar?start=${encodeURIComponent(r.concept)}|${encodeURIComponent(r.subTopic)}`)}
                      style={{ ...btnStyle, marginLeft: 6 }}
                    >
                      Practice
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim">No insights yet. Take a quiz to get started.</p>
            )}
          </div>
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
