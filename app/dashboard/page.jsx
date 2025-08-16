"use client";

import RecentGrammarCard from "./RecentGrammarCard";
import { useEffect, useState } from "react";
import books from "@/src/content/book-content.js";
import {
  ResponsiveContainer,
  LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import styles from "./Dashboard.module.css";

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
      <div className={styles.chips}>
        {rows.map((r, i) => {
          const href = `/grammar?concept=${encodeURIComponent(r.concept)}&subTopic=${encodeURIComponent(r.subTopic)}&start=1`;
          const title =
            `Attempts ${r.attempts} · Acc ${Math.round((r.accuracy || 0) * 100)}%` +
            (typeof r.avgSecPerQ === "number" ? ` · Pace ${r.avgSecPerQ.toFixed(1)}s/q` : "") +
            (typeof r.avgHintsPerQ === "number" && r.avgHintsPerQ > 0 ? ` · Hints ${r.avgHintsPerQ.toFixed(2)}/q` : "");
          return (
            <a key={i} href={href} title={title} className={styles.chip}>
              {r.concept} — {r.subTopic}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.headerRow}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <RecommendedChips />
        <div className={styles.growRight}>
          <button
            className={styles.btnDanger}
            onClick={async () => {
              try { localStorage.clear(); } catch { }
              try { await fetch("/api/sharecode", { method: "DELETE" }); } catch { }
              document.cookie = "learnloomId=; Max-Age=0; path=/";
              window.location.href = "/";
            }}
            aria-label="Clear my anonymous data"
          >
            Clear my traces
          </button>
        </div>
      </div>
      {err && <p style={{ color: "red" }}>{err}</p>}

      <section className={styles.gridCards}>
        {/* Quick Resume: Reading */}
        <div className={styles.card}>
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
                (window.location.href =
                  `/readingpal?bookIndex=${reading.bookIndex}&chapterIndex=${reading.chapterIndex}&resume=1`)
                }
                className={styles.btn}
              >
                Resume Reading
              </button>
            </>
          ) : (
            <p>No recent book progress.</p>
          )}
        </div>

        {/* Quick Resume: Upload */}
        <div className={styles.card}>
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
                className={styles.btn}
              >
                Resume Upload
              </button>
            </>
          ) : (
            <p>No recent upload reading.</p>
          )}
        </div>

        {/* Quick Resume: Grammar */}
        <div className={styles.card}>
          <h3 style={{ marginTop: 0 }}>🧠 Grammar</h3>
          {grammar ? (
            <>
              <p>
                Last practiced: <strong>{grammar.concept}</strong>
                {grammar.subTopic ? ` — ${grammar.subTopic}` : ""}
              </p>
              <button
                onClick={() => (window.location.href = `/grammar`)}
                className={styles.btn}
              >
                Practice More
              </button>
            </>
          ) : (
            <p>No recent grammar practice.</p>
          )}
        </div>
      </section>

      {/* Recent grammar mini-card */}
      <section className={styles.sectionTight}>
        <RecentGrammarCard />
      </section>

      {/* Progress charts */}
      <section className={styles.section}>
        <div className={styles.headerRow}>
          <h3 style={{ margin: 0 }}>📈 Progress</h3>
          <div className={styles.growRight}>
            <button
              onClick={() => setRangeDays(7)}
              className={rangeDays === 7 ? styles.btn : styles.btnSecondary}
            >7 days</button>
            <button
              onClick={() => setRangeDays(30)}
              className={rangeDays === 30 ? styles.btn : styles.btnSecondary}
            >30 days</button>
          </div>
        </div>

        {/* Reading minutes */}
        <div className={styles.card}>
          <h4 className={styles.h4}>Reading time (minutes / day)</h4>
          <div className={styles.chart}>
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
        <div className={styles.card} style={{ marginTop: 12 }}>
          <h4 className={styles.h4}>Grammar average score (/ day)</h4>
          <div className={styles.chart}>
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

          {/* Grammar pace (sec / question) */}
          <div className={styles.card} style={{ marginTop: 12 }}>
            <h4 className={styles.h4}>Grammar pace (sec / question)</h4>
            <div className={styles.chart}>
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

          {/* Grammar insights (top weak areas) */}
          <div className={styles.card} style={{ marginTop: 12 }}>
            <h4 className={styles.h4}>Grammar insights</h4>
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
                      className={styles.btnSecondary}
                      style={{ marginLeft: 6 }}
                    >
                      Practice
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.dim}>No insights yet. Take a quiz to get started.</p>
            )}
          </div>
        </div>
      </section>

      {/* Export Data */}
      <section className={styles.section}>
        <h3 style={{ marginTop: 0 }}>⬇️ Export Data</h3>
        <p style={{ color: "#555", marginTop: 4, marginBottom: 12 }}>
          Exports include only your anonymous activity tied to your browser’s cookie.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a href="/api/export?kind=reading" download="reading.csv" className={styles.btn}>Reading CSV</a>
          <a href="/api/export?kind=grammar" download="grammar.csv" className={styles.btn}>Grammar CSV</a>
          <a href="/api/export?kind=uploads" download="uploads.csv" className={styles.btn}>Uploads CSV</a>
          <a href="/api/export?kind=all" download="all_exports.zip" className={styles.btnSecondary}>All (ZIP)</a>
        </div>
      </section>
    </main>
  );
}
