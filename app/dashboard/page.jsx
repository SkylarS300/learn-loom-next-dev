"use client";

import styles from "./Dashboard.module.css";
import dynamic from "next/dynamic";
import RecommendedChips from "./RecommendedChips";
import NotesPanel from "./NotesPanel";
import { useEffect, useState } from "react";
import books from "@/src/content/book-content.js";
import { track } from "@/lib/rum";
import Navbar from "../Navbar";
import CodeLoginCard from "./CodeLoginCard";
import ConfirmClearModal from "./ConfirmClearModal";
import CodeModal from "../components/auth/CodeModal";

// Lazy-load the chart card to keep initial bundle small.
const LineCard = dynamic(() => import("./_charts/LineCard"), {
  ssr: false,
  loading: () => (
    <div className={styles.card}>
      <h4 className={styles.h4}>Loading chart…</h4>
      <div className={styles.chart} aria-busy="true" />
    </div>
  ),
});

const RecentGrammarCard = dynamic(() => import("./RecentGrammarCard"), {
  ssr: false,
  loading: () => (
    <div className={styles.card}>
      <h4 className={styles.h4}>Loading…</h4>
    </div>
  ),
});

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

  const [showClearModal, setShowClearModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [me, setMe] = useState({ ok: false, shortCode: null, loading: true });

  async function actuallyClearAll() {
    try { localStorage.clear(); } catch { }
    try { await fetch("/api/sharecode", { method: "DELETE" }); } catch { }
    try { await fetch("/api/session/logout", { method: "POST" }); } catch { }
    document.cookie = "learnloomId=; Max-Age=0; path=/";
    window.location.href = "/";
  }

  useEffect(() => {
    // mark dashboard start once per mount
    if (typeof window !== "undefined" && !window.__dashStart) {
      window.__dashStart = performance.now();
      track("dash_mount", { t: Math.round(window.__dashStart) });
    }
    (async () => {
      try {
        const r = await fetch("/api/quickresume");
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Failed");
        setData(j.data);
        track("dash_quickresume_loaded", {
          ms_from_mount: Math.round(performance.now() - (window.__dashStart || 0)),
        });
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  // Get shortCode for QR button (only 1 call; harmless if not logged-in)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/session/me", { cache: "no-store" });
        const j = await r.json();
        if (!dead) setMe({ ok: !!j?.ok, shortCode: j?.data?.shortCode ?? null, loading: false });
      } catch {
        if (!dead) setMe({ ok: false, shortCode: null, loading: false });
      }
    })();
    return () => { dead = true; };
  }, []);


  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/metrics?days=${rangeDays}`);
        const j = await r.json();
        if (j?.ok) setMetrics(j.data);
      } catch {
        /* no-op */
      }
    })();
  }, [rangeDays]);

  const reading = data?.reading;
  const upload = data?.upload;
  const grammar = data?.grammar;

  function titleForBookIndex(idx) {
    if (idx == null) return null;
    return books?.[idx]?.title || `Book #${idx}`;
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {/* Header row */}
        <div className={styles.headerRow}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <RecommendedChips />
          <div className={styles.growRight}>
            <button
              className={styles.btnDanger}
              onClick={() => setShowClearModal(true)}
              aria-label="Clear my anonymous data"
            >
              Clear my traces
            </button>
          </div>
        </div>

        {/* Simple sign-in / show-code card */}
        <section className={styles.sectionTight}>
          <CodeLoginCard />
          {me.ok && me.shortCode && (
            <div style={{ marginTop: 8 }}>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowCodeModal(true)}
              >
                Show QR
              </button>
            </div>
          )}
        </section>

        {err && <p style={{ color: "red" }}>{err}</p>}

        {/* Quick resume cards */}
        <section className={styles.gridCards}>
          {/* Reading */}
          <div className={styles.card}>
            <h3 style={{ marginTop: 0 }}>📖 Reading</h3>
            {reading ? (
              <>
                <p>
                  <strong>{titleForBookIndex(reading.bookIndex)}</strong>, Chapter{" "}
                  {Number.isInteger(reading.chapterIndex) ? reading.chapterIndex + 1 : "—"}
                  {Number.isInteger(reading.sentenceIndex)
                    ? `, Sentence ${reading.sentenceIndex + 1}`
                    : ""}
                </p>
                <button
                  onClick={() =>
                    (window.location.href = `/readingpal?bookIndex=${reading.bookIndex}&chapterIndex=${reading.chapterIndex}&resume=1`)
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

          {/* Upload */}
          <div className={styles.card}>
            <h3 style={{ marginTop: 0 }}>📤 Upload</h3>
            {upload ? (
              <>
                <p>
                  Upload #{upload.uploadId}
                  {Number.isInteger(upload.paraIndex) ? `, Paragraph ${upload.paraIndex}` : ""}
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

          {/* Grammar */}
          <div className={styles.card}>
            <h3 style={{ marginTop: 0 }}>🧠 Grammar</h3>
            {grammar ? (
              <>
                <p>
                  Last practiced: <strong>{grammar.concept}</strong>
                  {grammar.subTopic ? ` — ${grammar.subTopic}` : ""}
                </p>
                <button onClick={() => (window.location.href = `/grammar`)} className={styles.btn}>
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

        {/* Notes panel */}
        <section className={styles.section}>
          <NotesPanel />
        </section>

        {/* Progress charts */}
        <section className={styles.section}>
          <div className={styles.headerRow}>
            <h3 style={{ margin: 0 }}>📈 Progress</h3>
            <div className={styles.growRight}>
              <button
                onClick={() => setRangeDays(7)}
                className={rangeDays === 7 ? styles.btn : styles.btnSecondary}
              >
                7 days
              </button>
              <button
                onClick={() => setRangeDays(30)}
                className={rangeDays === 30 ? styles.btn : styles.btnSecondary}
              >
                30 days
              </button>
            </div>
          </div>

          {/* Reading minutes */}
          <LineCard
            title="Reading time (minutes / day)"
            data={metrics.readingDaily}
            yKey="minutes"
            yAxisWidth={40}
          />

          {/* Grammar average score */}
          <div style={{ marginTop: 12 }}>
            <LineCard
              title="Grammar average score (/ day)"
              data={metrics.grammarDaily}
              yKey="avg"
              yDomain={[0, 100]}
              yAxisWidth={40}
            />
          </div>

          {/* Grammar pace (sec / question) */}
          <div style={{ marginTop: 12 }}>
            <LineCard
              title="Grammar pace (sec / question)"
              data={metrics.grammarPaceDaily}
              yKey="secPerQ"
              yAxisWidth={40}
            />
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
                      (window.location.href = `/grammar?start=${encodeURIComponent(
                        r.concept
                      )}|${encodeURIComponent(r.subTopic)}`)}
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

          {/* Export Data */}
          <section className={styles.section}>
            <h3 style={{ marginTop: 0 }}>⬇️ Export Data</h3>
            <p style={{ color: "#555", marginTop: 4, marginBottom: 12 }}>
              Exports include only your anonymous activity tied to your browser’s cookie.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href="/api/export?kind=reading" download="reading.csv" className={styles.btn}>
                Reading CSV
              </a>
              <a href="/api/export?kind=grammar" download="grammar.csv" className={styles.btn}>
                Grammar CSV
              </a>
              <a href="/api/export?kind=uploads" download="uploads.csv" className={styles.btn}>
                Uploads CSV
              </a>
              <a
                href="/api/export?kind=all"
                download="all_exports.zip"
                className={styles.btnSecondary}
              >
                All (ZIP)
              </a>
            </div>
          </section>
        </section>
      </main>
      {/* Styled confirmation modal */}
      <ConfirmClearModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={actuallyClearAll}
      />
      {me.ok && me.shortCode && (
        <div style={{ marginTop: 8 }}>
          <button
            className={styles.btnSecondary}
            onClick={() => setShowCodeModal(true)}
          >
            Show QR
          </button>
        </div>
      )}
    </>
  );
}
