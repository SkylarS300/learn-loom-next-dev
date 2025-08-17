"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../Navbar";
import NavbarGuard from "../components/NavbarGuard";
import bank, { buildQuiz } from "@/src/grammar/buildQuiz";
import styles from "./grammar.module.css";

export default function Grammar() {
  // ----- Recommendations -----
  const search = useSearchParams();
  const [recs, setRecs] = useState([]);
  const [recErr, setRecErr] = useState("");
  const [recLoading, setRecLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/grammar/recommendations");
        const j = await r.json();
        if (!dead) j?.ok ? setRecs(j.data || []) : setRecErr(j?.error || "Failed");
      } catch {
        if (!dead) setRecErr("Failed to load recommendations");
      } finally {
        if (!dead) setRecLoading(false);
      }
    })();
    return () => { dead = true; };
  }, []);

  // ----- Custom form state -----
  const concepts = useMemo(() => Object.keys(bank || {}), []);
  const [concept, setConcept] = useState(concepts[0] || "");
  const subTopics = useMemo(
    () => (concept && bank?.[concept] ? Object.keys(bank[concept]) : []),
    [concept]
  );
  const [subTopic, setSubTopic] = useState("");
  useEffect(() => {
    setSubTopic((prev) => (subTopics.includes(prev) ? prev : subTopics[0] || ""));
  }, [subTopics]);
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(10);
  // Stats for badges
  const [stats, setStats] = useState([]);
  const [focusWeak, setFocusWeak] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/api/grammar/stats");
        const j = await r.json();
        if (!dead && j?.ok) setStats(j.data || []);
      } catch { }
    })();
    return () => { dead = true; };
  }, []);
  const [aiMode, setAiMode] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState(""); // shows inline banner (errors/info)
  const isAiRef = useRef(false);
  // — Notes modal state —
  const [noteData, setNoteData] = useState(null); // { concept, subTopic, anchorText, promptHash }

  // Sticky AI form (localStorage)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("aiFormV1") || "{}");
      if (typeof saved.aiMode === "boolean") setAiMode(saved.aiMode);
      if (typeof saved.aiText === "string") setAiText(saved.aiText);
    } catch { }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("aiFormV1", JSON.stringify({ aiMode, aiText })); } catch { }
  }, [aiMode, aiText]);

  // tiny hash for session cache key
  function fnv1a(str = "") {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  // ----- Quiz lifecycle -----
  const [mode, setMode] = useState("landing"); // landing | running | results | resume
  const [quiz, setQuiz] = useState(null);      // { concept, subTopic, items }
  const [result, setResult] = useState(null);  // { scorePct, numCorrect, total, durationMs }
  const [report, setReport] = useState(null);  // { prompt, concept, subTopic }
  const SESSION_KEY = "grammarSessionV1";

  // Prevent multiple auto-starts
  const deepLinkRan = useRef(false);

  // Offer resume if we detect an in-progress session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.concept && s?.subTopic && Array.isArray(s?.items) && s.index >= 0) {
        setMode("resume");
        setQuiz({ concept: s.concept, subTopic: s.subTopic, items: s.items });
      }
    } catch { }
  }, []);

  // Deep-link handler:
  //   /grammar?concept=...&subTopic=...&start=1
  // Back-compat:
  //   /grammar?start=Concept|Subtopic
  useEffect(() => {
    let c = search.get("concept");
    let s = search.get("subTopic");
    const startRaw = search.get("start");

    if ((!c || !s) && startRaw && startRaw.includes("|")) {
      const [cRaw, sRaw] = String(startRaw).split("|");
      c = decodeURIComponent(cRaw || "");
      s = decodeURIComponent(sRaw || "");
    }
    if (!c || !s) return;
    if (deepLinkRan.current) return;
    if (mode !== "landing") return;

    setConcept(c);
    setSubTopic(s);

    if (startRaw === "1" || (startRaw && startRaw.includes("|"))) {
      setTimeout(() => startQuizFrom(c, s), 80);
    }
    deepLinkRan.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mode]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const startArg = sp.get("start");
      if (!startArg) return;
      if (mode !== "landing") return;
      const [cRaw, sRaw] = String(startArg).split("|");
      const c = decodeURIComponent(cRaw || "");
      const s = decodeURIComponent(sRaw || "");
      if (c && s) startQuizFrom(c, s);
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function saveGrammarNote(payload) {
    try {
      if (!noteData) return;
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "grammar",
          concept: noteData.concept,
          subTopic: noteData.subTopic,
          promptHash: noteData.promptHash,
          anchorText: noteData.anchorText || "",
          body: payload.body,
          tags: payload.tags,
          color: payload.color,
          isBookmark: false,
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to save note");
      alert("Note saved!");
      setNoteData(null);
    } catch (e) {
      alert(e.message || "Failed to save note");
    }
  }

  async function startQuizFrom(c, s, diff = difficulty, n = count) {
    isAiRef.current = false;
    if (aiMode) {
      setAiMsg("");
      setAiLoading(true);
      try {
        const cacheKey = `aiQuizCache::${c}|${s}|${diff}|${n}|${fnv1a(aiText)}`;
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const items = JSON.parse(cached);
            if (Array.isArray(items) && items.length) {
              setQuiz({ concept: c, subTopic: s, items });
              setResult(null);
              setMode("running");
              isAiRef.current = true;
              try {
                localStorage.setItem(SESSION_KEY, JSON.stringify({ concept: c, subTopic: s, items, index: 0, correct: 0, elapsed: 0 }));
              } catch { }
              return;
            }
          }
        } catch { }

        const r = await fetch("/api/ai/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiText, concept: c, subTopic: s, difficulty: diff, count: n }),
        });
        const j = await r.json();
        if (r.status === 501) {
          setAiMsg(j?.error || "AI quiz is disabled by the server.");
        } else if (j?.ok && Array.isArray(j.items) && j.items.length) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(j.items)); } catch { }
          setQuiz({ concept: c, subTopic: s, items: j.items });
          setResult(null);
          setMode("running");
          isAiRef.current = true;
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ concept: c, subTopic: s, items: j.items, index: 0, correct: 0, elapsed: 0 }));
          } catch { }
          return;
        } else {
          setAiMsg(
            r.status === 429
              ? (j?.error || "AI is rate-limited right now. Falling back to built-in questions.")
              : (j?.error || "AI generator returned no questions.")
          );
        }
      } catch {
        setAiMsg("AI generator error. Falling back to built-in questions.");
      } finally {
        setAiLoading(false);
      }
      // If AI path failed, we fall back to the bank below.
    }
    const q = buildQuiz({ concept: c, subTopic: s, difficulty: diff, count: n, allowShort: false, seed: Date.now() % 100000 });
    if (!q.items?.length) return alert("Not enough questions yet in this area.");
    setQuiz(q);
    setResult(null);
    setMode("running");
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ concept: q.concept, subTopic: q.subTopic, items: q.items, index: 0, correct: 0, elapsed: 0 }));
    } catch { }
  }

  async function onFinish(summary) {
    setResult(summary);
    setMode("results");
    try {
      await fetch("/api/grammarprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: quiz.concept,
          subTopic: quiz.subTopic,
          score: Math.round(summary.scorePct),
          numQuestions: summary.total,
          durationMs: Math.round(summary.durationMs || 0),
          isAi: !!isAiRef.current,
          hintsUsed: Math.max(0, Math.round(summary.hintsUsed || 0)),
        }),
      });
    } catch { }
  }

  function GrammarNoteModal({ data, onClose, onSubmit }) {
    const [body, setBody] = useState("");
    const [tags, setTags] = useState("");
    const [color, setColor] = useState("#F59E0B"); // amber default


    return (
      <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
        <div className={styles.modalCard}>
          <h3 style={{ marginTop: 0 }}>Add a note</h3>
          <p style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
            <strong>{humanize(data.concept)}</strong> — {humanize(data.subTopic)}
          </p>
          <p style={{ fontSize: 13, color: "#666" }}>
            Anchor: “{data.anchorText.slice(0, 160)}{data.anchorText.length > 160 ? "…" : ""}”
          </p>
          <textarea
            className={styles.textarea}
            placeholder="Write your note… (max 2000 chars)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 160px" }}>
            <input
              className={styles.textarea}
              placeholder="tags, comma,separated"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <input
              className={styles.textarea}
              placeholder="#F59E0B"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button className={styles.btn} onClick={onClose}>Cancel</button>
            <button
              className={styles.btnPrimary}
              disabled={!body.trim()}
              onClick={() =>
                onSubmit({
                  body: body.trim(),
                  tags: tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 10),
                  color: color || null,
                })
              }
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div id="main-content">
      <NavbarGuard>
        <Navbar />
      </NavbarGuard>

      <div className={styles.columns}>
        {/* ---- Sidebar ---- */}
        <aside id="quizList" className={styles.sidebar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={focusWeak} onChange={e => setFocusWeak(e.target.checked)} />
              <span>Focus weak areas</span>
            </label>
          </div>

          {concepts.map((c) => (
            <div key={c} style={{ marginBottom: 12 }}>
              <h2 className={styles.sidebarHeading}>{humanize(c)}</h2>
              {(bank[c] ? Object.keys(bank[c]) : []).map((s) => {
                const st = stats.find(x => x.concept === c && x.subTopic === s);
                const attempts = st?.attempts || 0;
                const avg = st?.avgScore ?? null;
                const mastered = attempts >= 3 && (avg ?? 0) >= 80;
                if (focusWeak && mastered) return null;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a
                      className={styles.sidebarLink}
                      onClick={() => startQuizFrom(c, s)}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        margin: "2px 0",
                        opacity: mastered ? 0.6 : 1
                      }}
                      title={attempts ? `Attempts: ${attempts} · Avg: ${Math.round((avg || 0))}%` : "No attempts yet"}
                    >
                      {humanize(s)}
                    </a>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: attempts ? (mastered ? "#ecfdf5" : "#fff7ed") : "#f3f4f6",
                        color: mastered ? "#065f46" : attempts ? "#9a3412" : "#6b7280",
                      }}
                    >
                      {attempts ? `${Math.round(avg || 0)}% • ${attempts}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        {/* ---- Content ---- */}
        <div id="textContainer" className={styles.content}>
          {/* Global note modal (always available regardless of mode) */}
          {noteData && (
            <GrammarNoteModal
              data={noteData}
              onClose={() => setNoteData(null)}
              onSubmit={saveGrammarNote}
            />
          )}
          {mode === "resume" && quiz && (
            <section className={styles.card} style={{ textAlign: "center" }}>
              ...
            </section>
          )}

          {mode === "landing" && (
            <>
              {/* Recommended panel */}
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Recommended</h2>
                {recLoading && <p className={styles.dim}>Loading…</p>}
                {recErr && <p style={{ color: "#c0392b" }}>{recErr}</p>}

                {!recLoading && !recErr && (recs?.length ? (
                  <div className={styles.grid3}>
                    {recs.map((r, i) => (
                      <div key={i} className={styles.subcard}>
                        <div className={styles.recTitle}>{humanize(r.concept)}</div>
                        <div className={styles.recSub}>{humanize(r.subTopic)}</div>
                        <div className={styles.metaRow}>
                          Attempts: <strong>{r.attempts}</strong> • Acc:{" "}
                          <strong>{Math.round((r.accuracy || 0) * 100)}%</strong>
                          {" "}| Conf: <strong>{Math.round((r.confidence || 0) * 100)}%</strong>
                          {typeof r.avgSecPerQ === "number" && (
                            <> | Pace: <strong>{Math.round(r.avgSecPerQ)}s/q</strong></>
                          )}
                          {typeof r.streakDays === "number" && r.streakDays > 0 && (
                            <> | Streak: <strong>{r.streakDays}d</strong></>
                          )}
                        </div>
                        {r.attempts < 5 && (
                          <div className={styles.badgeWarn}>
                            Limited data — do a few more rounds for better recommendations
                          </div>
                        )}
                        <button className={styles.btn} onClick={() => startQuizFrom(r.concept, r.subTopic)}>
                          Start practice
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.dim}>No history yet. Try a starter quiz below.</p>
                ))}
              </section>

              {/* Custom quiz */}
              <section className={styles.card} style={{ marginTop: 16 }}>
                <h2 className={styles.cardTitle}>Custom quiz</h2>
                <div className={styles.formGrid}>
                  <label className={styles.formLabel}>
                    <span>Concept</span>
                    <select value={concept} onChange={(e) => setConcept(e.target.value)} className={styles.input}>
                      {concepts.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.formLabel}>
                    <span>Subtopic</span>
                    <select value={subTopic} onChange={(e) => setSubTopic(e.target.value)} className={styles.input}>
                      {subTopics.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.formLabel}>
                    <span>Difficulty</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={styles.input}>
                      <option value="mixed">Mixed</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                  <label className={styles.formLabel}>
                    <span>Questions</span>
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={styles.input}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                    </select>
                  </label>
                </div>

                {/* AI generator */}
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={aiMode}
                      onChange={(e) => setAiMode(e.target.checked)}
                    />
                    <span>Use AI (generate from my text)</span>
                  </label>
                  {aiMode ? (
                    <textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      placeholder="Paste a short passage to generate questions from…"
                      rows={5}
                      className={styles.textarea}
                      style={{ minHeight: 120 }}
                    />
                  ) : null}
                </div>
                <div style={{ marginTop: 12 }}>
                  {aiMsg ? (
                    <div
                      role="status"
                      style={{
                        background: "#fffbea",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        padding: "8px 10px",
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      {aiMsg}
                    </div>
                  ) : null}
                  <button
                    className={styles.btnPrimary}
                    disabled={aiLoading || (aiMode && !aiText.trim())}
                    onClick={() => startQuizFrom(concept, subTopic)}
                  >
                    {aiLoading ? "Generating…" : "Start quiz"}
                  </button>
                </div>
              </section>
            </>
          )}

          {mode === "running" && quiz && (
            <QuizRunner
              quiz={quiz}
              sessionKey={SESSION_KEY}
              onFinish={(sum) => {
                try { localStorage.removeItem(SESSION_KEY); } catch { }
                onFinish(sum);
              }}
              onCancel={() => {
                try { localStorage.removeItem(SESSION_KEY); } catch { }
                setMode("landing");
              }}
              openNote={(data) => {
                console.log("[Grammar] openNote called:", data);
                setNoteData(data);
              }} hashFn={fnv1a}
            />
          )}

          {mode === "results" && result && (
            <section className={styles.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ marginTop: 0, marginBottom: 0 }}>Results</h2>
                {!!isAiRef.current && (
                  <span
                    aria-label="From AI"
                    title="This quiz was generated by AI"
                    style={{
                      fontSize: 12, padding: "2px 8px",
                      borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb"
                    }}
                  >
                    From AI
                  </span>
                )}
              </div>
              <p style={{ fontSize: 18, margin: 0 }}>
                <strong>{humanize(quiz.concept)}</strong> — {humanize(quiz.subTopic)}
              </p>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 48, margin: "8px 0" }}>
                  {Math.round(result.scorePct)}%
                </p>
                <p style={{ marginTop: 0 }}>
                  {result.numCorrect}/{result.total} correct • {Math.round(result.durationMs / 1000)}s
                </p>
              </div>

              {/* Review answers */}
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Review answers</summary>
                <div className={styles.reviewList}>
                  {result.answers?.map((a, idx) => {
                    const item = quiz.items[a.index];
                    const userText = item.choices?.[a.sel] ?? "(n/a)";
                    const correctText = item.choices?.[item.answerIndex] ?? "(n/a)";
                    const ok = a.correct;
                    return (
                      <div key={idx} className={styles.reviewRow}>
                        <div className={styles.reviewPrompt}>{idx + 1}. {item.prompt}</div>
                        <div className={styles.reviewCols}>
                          <div className={ok ? styles.good : styles.bad}>
                            Your answer: {userText}
                          </div>
                          {!ok && (
                            <div>
                              Correct: <strong>{correctText}</strong>
                            </div>
                          )}
                        </div>
                        {item.explanation && (
                          <div className={styles.reviewExpl}>{item.explanation}</div>
                        )}
                        <button
                          className={styles.linkBtn}
                          onClick={() => setReport({ prompt: item.prompt, concept: quiz.concept, subTopic: quiz.subTopic })}
                        >
                          Report an issue
                        </button>
                        <button
                          className={styles.linkBtn}
                          onClick={() => {
                            setReport(null);
                            setNoteData({
                              concept: quiz.concept,
                              subTopic: quiz.subTopic,
                              anchorText: item.prompt || "",
                              promptHash: fnv1a(item.prompt || ""),
                            });
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          Add note
                        </button>

                      </div>
                    );
                  })}
                </div>
              </details>

              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <button className={styles.btn} onClick={() => startQuizFrom(quiz.concept, quiz.subTopic)}>Retry</button>
                <button className={styles.btn} onClick={() => setMode("landing")}>Back</button>
              </div>

              {report && (
                <ReportModal
                  data={report}
                  onClose={() => setReport(null)}
                  onSubmit={async (issueText) => {
                    try {
                      const r = await fetch("/api/quizfeedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...report, issue: issueText }),
                      });
                      const j = await r.json();
                      if (!j?.ok) alert(j?.error || "Failed to send");
                      else alert("Thanks! We logged your report.");
                    } catch {
                      alert("Failed to send");
                    } finally {
                      setReport(null);
                    }
                  }}
                />
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// Humanize helpers
function humanize(s = "") {
  return String(s)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function ReportModal({ data, onClose, onSubmit }) {
  const [txt, setTxt] = useState("");
  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <h3 style={{ marginTop: 0 }}>Report an issue</h3>
        <p style={{ fontSize: 14, color: "#555" }}>
          <strong>Question:</strong> {data.prompt}
        </p>
        <textarea
          className={styles.textarea}
          placeholder="Describe what’s wrong (miskeyed answer, unclear wording, etc.)"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          rows={5}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} disabled={!txt.trim()} onClick={() => onSubmit(txt.trim())}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Quiz Runner (accessible + keyboard) ----
function QuizRunner({ quiz, sessionKey, onFinish, onCancel, openNote, hashFn }) {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const hintedSetRef = useRef(new Set());
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const lastTickRef = useRef(0);
  const elapsedRef = useRef(0);
  const [, forceTick] = useState(0);
  const [answers, setAnswers] = useState([]);

  const MISS_KEY = "grammarMistakesV1";
  function bumpMiss(prompt, delta) {
    if (typeof window === "undefined") return;
    try {
      const key = `${quiz.concept}|${quiz.subTopic}|${prompt}`;
      const map = JSON.parse(localStorage.getItem(MISS_KEY) || "{}");
      const cur = map[key] || { count: 0, last: 0 };
      const next = { count: Math.max(0, (cur.count || 0) + delta), last: Date.now() };
      if (next.count === 0) delete map[key]; else map[key] = next;
      localStorage.setItem(MISS_KEY, JSON.stringify(map));
    } catch { }
  }

  // Initialize from stored session index if present (resume path)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(sessionKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.index >= 0) {
          setI(s.index);
          setSel(null);
          setChecked(false);
          setFeedback("");
          elapsedRef.current = Number(s.elapsed || 0);
          setCorrectCount(Number(s.correct || 0));
        }
      }
    } catch { }
  }, [sessionKey]);

  const q = quiz.items[i];
  const total = quiz.items.length;

  useEffect(() => {
    startRef.current = performance.now();
    lastTickRef.current = startRef.current;
    const iv = setInterval(() => {
      if (!paused) {
        const now = performance.now();
        elapsedRef.current += now - lastTickRef.current;
        lastTickRef.current = now;
        forceTick((x) => (x + 1) % 1_000_000);
      } else {
        lastTickRef.current = performance.now();
      }
    }, 500);
    return () => clearInterval(iv);
  }, [paused]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (!checked) {
        const n = Number(e.key);
        if (n >= 1 && n <= 9 && q?.choices?.[n - 1]) setSel(n - 1);
        if (e.key === "Enter") handleCheck();
        if (e.key.toLowerCase() === "n") {
          // open Grammar note modal for the current question
          const h = (hashFn ? hashFn(q?.prompt || "") : String((q?.prompt || "").length));
          console.log("[QuizRunner] N pressed");
          openNote && openNote({
            targetType: "grammar",
            concept: quiz.concept,
            subTopic: quiz.subTopic,
            anchorText: q?.prompt || "",
            promptHash: h,
          });
        }
      } else if (e.key === "Enter") {
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, paused, q, openNote, hashFn]);

  // Persist minimal session state
  useEffect(() => {
    try {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          concept: quiz.concept,
          subTopic: quiz.subTopic,
          items: quiz.items,
          index: i,
          correct: correctCount,
          elapsed: elapsedRef.current,
        })
      );
    } catch { }
  }, [i, correctCount, quiz, sessionKey]);

  function handleCheck() {
    if (q.kind !== "mcq" || sel == null) return;
    setHintOpen(false);
    const isCorrect = sel === q.answerIndex;
    if (isCorrect) setCorrectCount((c) => c + 1);
    setFeedback(isCorrect ? "Correct!" : "Try again next time.");
    setChecked(true);
    setAnswers((arr) => [...arr, { index: i, sel, correct: isCorrect }]);
    if (!isCorrect) bumpMiss(q.prompt, +1);
    else bumpMiss(q.prompt, -1);
  }

  function next() {
    if (i + 1 < total) {
      setI(i + 1);
      setSel(null);
      setChecked(false);
      setFeedback("");
      setHintOpen(false);
    } else {
      const durationMs = elapsedRef.current + (performance.now() - lastTickRef.current);
      const scorePct = (correctCount / total) * 100;
      onFinish({ scorePct, numCorrect: correctCount, total, durationMs, answers, hintsUsed });
    }
  }

  if (paused) {
    return (
      <section className={styles.card} style={{ textAlign: "center" }}>
        <h2>Paused</h2>
        <p>Press <kbd>Esc</kbd> to resume.</p>
        <button className={styles.btn} onClick={() => setPaused(false)}>Resume</button>
        <button className={styles.btn} onClick={onCancel}>Exit</button>
        {!checked && (
          <button
            className={styles.btn}
            onClick={() => openNote?.({
              targetType: "grammar",
              concept: quiz.concept,
              subTopic: quiz.subTopic,
              anchorText: q?.prompt || "",
              promptHash: (typeof hashFn === "function" ? hashFn(q?.prompt || "") : String((q?.prompt || "").length)),
            })}
            title="Add a quick note (N)"
          >
            Add note (N)
          </button>
        )}
      </section>
    );
  }
  if (!q) return null;

  const secs = Math.max(0, Math.round(elapsedRef.current / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <section className={styles.card} aria-live="polite">
      <div className={styles.runnerTop}>
        <h2 className={styles.cardTitle} style={{ margin: 0, flex: 1 }}>
          {humanize(quiz.concept)} — {humanize(quiz.subTopic)}
        </h2>
        <div className={styles.topMeta}>
          <span>{i + 1} / {total}</span>
          <span>⏱ {mm}:{ss}</span>
        </div>
      </div>
      <p style={{ fontSize: 18 }}>{q.prompt}</p>
      <div role="radiogroup" aria-label="Choices" style={{ display: "grid", gap: 8 }}>
        {q.choices?.map((choice, idx) => {
          const isSel = sel === idx;
          const isCorrectChoice = checked && idx === q.answerIndex;
          const isWrongSel = checked && isSel && idx !== q.answerIndex;
          return (
            <button
              key={idx}
              role="radio"
              aria-checked={isSel}
              onClick={() => setSel(idx)}
              disabled={checked}
              className={styles.choiceBtn}
              style={{
                borderColor: isSel ? "#3b82f6" : "#ddd",
                outline: isSel ? "2px solid #93c5fd" : "none",
                background: isCorrectChoice ? "#ecfdf5" : isWrongSel ? "#fef2f2" : "white",
              }}
            >
              <span style={{ opacity: 0.6, marginRight: 6 }}>{idx + 1}.</span> {choice}
            </button>
          );
        })}
      </div>

      {/* Hint (no grading impact; counts once per question) */}
      {q.explanation && !checked && (
        <div style={{ margin: "8px 0" }}>
          <button
            className={styles.btn}
            onClick={() => {
              setHintOpen((open) => {
                const next = !open;
                if (next && !hintedSetRef.current.has(i)) {
                  hintedSetRef.current.add(i);
                  setHintsUsed((h) => h + 1);
                }
                return next;
              });
            }}
          >
            {hintOpen ? "Hide hint" : "Show hint"}
          </button>
          {hintOpen && (
            <div style={{ marginTop: 6, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0c4a6e", padding: "8px 10px", borderRadius: 6 }}>
              {q.explanation}
            </div>
          )}
        </div>
      )}

      <div className={styles.controlsRow}>
        {typeof openNote === "function" && (
          <button
            className={styles.btn}
            title="Add a note (N)"
            onClick={() => {
              const h = (typeof hashFn === "function" ? hashFn(q?.prompt || "") : String((q?.prompt || "").length));
              openNote({
                targetType: "grammar",
                concept: quiz.concept,
                subTopic: quiz.subTopic,
                anchorText: q?.prompt || "",
                promptHash: h,
              });
            }}
          >
            📝 Note
          </button>
        )}
        {!checked ? (
          <button className={styles.btnPrimary} disabled={sel == null} onClick={handleCheck}>
            Check <span style={{ opacity: 0.6 }}>(Enter)</span>
          </button>
        ) : (
          <button className={styles.btnPrimary} onClick={next}>
            {i + 1 < total ? "Next" : "Finish"} <span style={{ opacity: 0.6 }}>(Enter)</span>
          </button>
        )}
        <button className={styles.btn} onClick={() => setPaused(true)}>Pause <span style={{ opacity: 0.6 }}>(Esc)</span></button>
        <button className={styles.btn} onClick={onCancel}>Exit</button>
      </div>

      {checked && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700 }}>{feedback}</div>
          {q.explanation && <div style={{ color: "#555", marginTop: 4 }}>{q.explanation}</div>}
        </div>
      )}

    </section>
  );
}
