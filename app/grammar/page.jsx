"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../Navbar";
import bank, { buildQuiz } from "@/src/grammar/buildQuiz";

export default function Grammar() {
  // ----- Recommendations -----
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

  // ----- Quiz lifecycle -----
  const [mode, setMode] = useState("landing"); // landing | running | results | resume
  const [quiz, setQuiz] = useState(null);      // { concept, subTopic, items }
  const [result, setResult] = useState(null);  // { scorePct, numCorrect, total, durationMs }
  const SESSION_KEY = "grammarSessionV1";

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

  function startQuizFrom(c, s, diff = difficulty, n = count) {
    const q = buildQuiz({ concept: c, subTopic: s, difficulty: diff, count: n, allowShort: false, seed: Date.now() % 100000 });
    if (!q.items?.length) return alert("Not enough questions yet in this area.");
    setQuiz(q);
    setResult(null);
    setMode("running");
    // seed fresh session
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
          durationMs: summary.durationMs,
        }),
      });
    } catch { }
  }

  return (
    <div id="main-content" className="grammar-layout">
      <Navbar />
      <div className="grammar-columns">
        {/* ---- Sidebar: topics from bank (keeps your two-column layout) ---- */}
        <aside id="quizList" className="grammar-sidebar">
          {concepts.map((c) => (
            <div key={c} style={{ marginBottom: 12 }}>
              <h2 style={{ margin: "12px 0 6px" }}>{c}</h2>
              {(bank[c] ? Object.keys(bank[c]) : []).map((s) => (
                <div key={s}>
                  <a
                    className="subsection-link"
                    onClick={() => startQuizFrom(c, s)}
                    style={{ cursor: "pointer", display: "inline-block", margin: "2px 0" }}
                  >
                    {s}
                  </a>
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* ---- Content ---- */}
        <div id="textContainer" className="grammar-content">
          {mode === "resume" && quiz && (
            <section style={{ ...cardWrap, textAlign: "center" }}>
              <h2 style={{ marginTop: 0 }}>Resume your last quiz?</h2>
              <p><strong>{quiz.concept}</strong> — {quiz.subTopic}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button style={btnPrimary} onClick={() => setMode("running")}>Resume</button>
                <button
                  style={btn}
                  onClick={() => {
                    try { localStorage.removeItem(SESSION_KEY); } catch { }
                    setMode("landing");
                    setQuiz(null);
                  }}
                >
                  Discard
                </button>
              </div>
            </section>
          )}
          {mode === "landing" && (
            <>
              {/* Recommended panel */}
              <section style={cardWrap}>
                <h2 style={{ marginTop: 0 }}>Recommended</h2>
                {recLoading && <p className="dim">Loading…</p>}
                {recErr && <p style={{ color: "#c0392b" }}>{recErr}</p>}
                {!recLoading && !recErr && (recs?.length ? (
                  <div style={grid3}>
                    {recs.map((r, i) => (
                      <div key={i} style={card}>
                        <div style={{ fontWeight: 700 }}>{r.concept}</div>
                        <div style={{ color: "#555" }}>{r.subTopic}</div>
                        <div style={{ fontSize: 12, marginTop: 6 }}>
                          Attempts: <strong>{r.attempts}</strong> • Acc:{" "}
                          <strong>{Math.round((r.accuracy || 0) * 100)}%</strong>
                          {" "}| Conf: <strong>{Math.round((r.confidence || 0) * 100)}%</strong>
                        </div>
                        {r.attempts < 5 && (
                          <div style={{ fontSize: 12, color: "#8a6d3b", background: "#fff7e6", border: "1px solid #ffe7ba", borderRadius: 6, padding: "2px 6px", display: "inline-block", marginTop: 6 }}>
                            Limited data — do a few more rounds for better recommendations
                          </div>
                        )}
                        <button style={btn} onClick={() => startQuizFrom(r.concept, r.subTopic)}>
                          Start practice
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="dim">No history yet. Try a starter quiz below.</p>
                ))}
              </section>

              {/* Custom quiz */}
              <section style={{ ...cardWrap, marginTop: 16 }}>
                <h2 style={{ marginTop: 0 }}>Custom quiz</h2>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 12 }}>
                  <label style={label}>
                    <span>Concept</span>
                    <select value={concept} onChange={(e) => setConcept(e.target.value)} style={input}>
                      {concepts.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={label}>
                    <span>Subtopic</span>
                    <select value={subTopic} onChange={(e) => setSubTopic(e.target.value)} style={input}>
                      {subTopics.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label style={label}>
                    <span>Difficulty</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={input}>
                      <option value="mixed">Mixed</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                  <label style={label}>
                    <span>Questions</span>
                    <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={input}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                    </select>
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button style={btnPrimary} onClick={() => startQuizFrom(concept, subTopic)}>
                    Start quiz
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
            />)}

          {mode === "results" && result && (
            <section style={{ ...cardWrap, textAlign: "center" }}>
              <h2 style={{ marginTop: 0 }}>Results</h2>
              <p style={{ fontSize: 18, margin: 0 }}>
                <strong>{quiz.concept}</strong> — {quiz.subTopic}
              </p>
              <p style={{ fontSize: 48, margin: "8px 0" }}>
                {Math.round(result.scorePct)}%
              </p>
              <p style={{ marginTop: 0 }}>
                {result.numCorrect}/{result.total} correct • {Math.round(result.durationMs / 1000)}s
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
                <button style={btn} onClick={() => startQuizFrom(quiz.concept, quiz.subTopic)}>Retry</button>
                <button style={btn} onClick={() => setMode("landing")}>Back</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Quiz Runner (accessible + keyboard) ----
function QuizRunner({ quiz, sessionKey, onFinish, onCancel }) {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const lastTickRef = useRef(0);
  const elapsedRef = useRef(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      } else if (e.key === "Enter") {
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, paused, q]);

  // Persist minimal session state
  useEffect(() => {
    try {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          concept: quiz.concept,
          subTopic: quiz.subTopic,
          items: quiz.items, // lightweight MCQs; no PII
          index: i,
          correct: correctCount,
          elapsed: elapsedRef.current,
        })
      );
    } catch { }
  }, [i, correctCount, quiz, sessionKey]);


  function handleCheck() {
    if (q.kind !== "mcq" || sel == null) return;
    const isCorrect = sel === q.answerIndex;
    if (isCorrect) setCorrectCount((c) => c + 1);
    setFeedback(isCorrect ? "Correct!" : "Try again next time.");
    setChecked(true);
  }
  function next() {
    if (i + 1 < total) {
      setI(i + 1);
      setSel(null);
      setChecked(false);
      setFeedback("");
    } else {
      const durationMs = elapsedRef.current + (performance.now() - lastTickRef.current);
      const scorePct = (correctCount / total) * 100;
      onFinish({ scorePct, numCorrect: correctCount, total, durationMs });
    }
  }

  if (paused) {
    return (
      <section style={{ ...cardWrap, textAlign: "center" }}>
        <h2>Paused</h2>
        <p>Press <kbd>Esc</kbd> to resume.</p>
        <button style={btn} onClick={() => setPaused(false)}>Resume</button>
        <button style={btn} onClick={onCancel}>Exit</button>
      </section>
    );
  }
  if (!q) return null;

  return (
    <section style={cardWrap} aria-live="polite">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>{quiz.concept} — {quiz.subTopic}</h2>
        <div className="dim">{i + 1} / {total}</div>
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
              style={{
                ...choiceStyle,
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
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {!checked ? (
          <button style={btnPrimary} disabled={sel == null} onClick={handleCheck}>
            Check <span style={{ opacity: 0.6 }}>(Enter)</span>
          </button>
        ) : (
          <button style={btnPrimary} onClick={next}>
            {i + 1 < total ? "Next" : "Finish"} <span style={{ opacity: 0.6 }}>(Enter)</span>
          </button>
        )}
        <button style={btn} onClick={() => setPaused(true)}>Pause <span style={{ opacity: 0.6 }}>(Esc)</span></button>
        <button style={btn} onClick={onCancel}>Exit</button>
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

// ---- styles ----
const cardWrap = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
const grid3 = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 12 };
const card = { ...cardWrap, padding: 12 };
const label = { display: "grid", gap: 6, fontSize: 14 };
const input = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 };
const btn = { background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnPrimary = { ...btn, background: "#0070f3", color: "#fff", border: "none" };
const choiceStyle = { ...btn, textAlign: "left" };