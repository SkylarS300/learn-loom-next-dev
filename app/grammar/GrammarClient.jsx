'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
// Keep this relative path stable regardless of alias config
import bank, { buildQuiz } from "../../src/grammar/buildQuiz";
import styles from "./grammar.module.css";

// Lazy to avoid SSR pitfalls
const NotesModal = dynamic(() => import("../readingpal/NotesModal"), { ssr: false });

export default function GrammarClient() {
    // ---------------- debug ----------------
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log("[GrammarClient] mounted", { hasBank: !!bank, concepts: bank ? Object.keys(bank).length : 0 });
    }, []);

    if (!bank || typeof bank !== "object") {
        return (
            <main style={{ maxWidth: 620, margin: "32px auto", padding: 16 }}>
                <h1>Grammar unavailable</h1>
                <p className={styles.dim}>The question bank didn’t load.</p>
                <ul className={styles.dim}>
                    <li>
                        Check <code>src/grammar/bank/fromStatic.js</code> import path (<code>../../content/quizzes.js</code>).
                    </li>
                    <li>
                        Confirm <code>src/content/quizzes.js</code> exists and exports an object.
                    </li>
                </ul>
            </main>
        );
    }

    // ---------------- recommendations ----------------
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
                if (!dead) {
                    if (j?.ok) {
                        const rows = Array.isArray(j.data) ? j.data.slice() : [];
                        // Sort: higher weakness first, fewer attempts first, then alpha
                        rows.sort((a, b) => {
                            const w = (b.weakness ?? 0) - (a.weakness ?? 0);
                            if (w) return w;
                            const at = (a.attempts ?? 0) - (b.attempts ?? 0);
                            if (at) return at;
                            const ca = String(a.concept || "");
                            const cb = String(b.concept || "");
                            if (ca !== cb) return ca.localeCompare(cb);
                            return String(a.subTopic || "").localeCompare(String(b.subTopic || ""));
                        });
                        setRecs(rows);
                    } else {
                        setRecErr(j?.error || "Failed");
                    }
                }
            } catch {
                if (!dead) setRecErr("Failed to load recommendations");
            } finally {
                if (!dead) setRecLoading(false);
            }
        })();
        return () => { dead = true; };
    }, []);

    // ---------------- bank-driven pickers ----------------
    const concepts = useMemo(() => {
        try { return Object.keys(bank || {}); } catch { return []; }
    }, []);
    const [concept, setConcept] = useState(concepts[0] || "");
    const subTopics = useMemo(() => {
        try { return (concept && bank?.[concept]) ? Object.keys(bank[concept]) : []; } catch { return []; }
    }, [concept]);
    const [subTopic, setSubTopic] = useState("");
    useEffect(() => {
        setSubTopic((prev) => (subTopics.includes(prev) ? prev : subTopics[0] || ""));
    }, [subTopics]);

    const [difficulty, setDifficulty] = useState("mixed");
    const [count, setCount] = useState(10);

    // ---------------- stats badge ----------------
    const [stats, setStats] = useState([]);
    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                const r = await fetch("/api/grammar/stats");
                const j = await r.json();
                if (!dead && j?.ok) setStats(j.data || []);
            } catch { /* no-op */ }
        })();
        return () => { dead = false; };
    }, []);
    const currentBadge = useMemo(() => {
        const key = `${concept}:::${subTopic}`;
        const row = (stats || []).find(s => `${s.concept}:::${s.subTopic}` === key);
        if (!row) return null;
        const latest = Number.isFinite(row.latestScore) ? Math.round(row.latestScore) : null;
        const attempts = row.series?.length ?? row.attempts ?? null;
        return { latest, attempts };
    }, [stats, concept, subTopic]);

    // Fallback suggestions if no personalized recs available
    const fallback = useMemo(() => {
        const picks = [];
        const pushIf = (c, s) => {
            if (bank?.[c]?.[s]) picks.push({ concept: c, subTopic: s, attempts: 0 });
        };
        // sensible defaults if present
        pushIf("Articles", "Basics");
        pushIf("verbTenses", "Future Simple vs. Future Continuous");
        // any first available as a final fallback
        if (!picks.length && concepts.length) {
            const c = concepts[0];
            const subs = Object.keys(bank[c] || {});
            if (subs.length) picks.push({ concept: c, subTopic: subs[0], attempts: 0 });
        }
        return picks;
    }, [concepts]);


    // ---------------- AI controls (kept; used if enabled) ----------------
    const [aiMode, setAiMode] = useState(false);
    const [aiText, setAiText] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiMsg, setAiMsg] = useState("");
    const isAiRef = useRef(false);

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

    const fnv1a = (str = "") => {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return ("0000000" + h.toString(16)).slice(-8);
    };

    // ---------------- session / quiz lifecycle ----------------
    const [mode, setMode] = useState("landing"); // landing | running | results | resume
    const [quiz, setQuiz] = useState(null);      // { concept, subTopic, items }
    const [result, setResult] = useState(null);  // { scorePct, numCorrect, total, durationMs, hintsUsed }
    const [report, setReport] = useState(null);  // (optional) your summary/report payload
    const SESSION_KEY = "grammarSessionV1";
    const deepLinkRan = useRef(false);

    // in-runner state
    const [qIndex, setQIndex] = useState(0);
    const [selected, setSelected] = useState(null);
    const [revealed, setRevealed] = useState(false);
    const [correctSoFar, setCorrectSoFar] = useState(0);
    const [startTs, setStartTs] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [hiddenChoices, setHiddenChoices] = useState(new Set());
    const tickRef = useRef(null);

    const [paused, setPaused] = useState(false);
    const answersRef = useRef([]); // persist user selections by index

    // Notes modal
    const [noteData, setNoteData] = useState(null); // { concept, subTopic, anchorText, promptHash }

    // restore resume
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

    const livePing = (m = "grammar") => {
        try {
            const blob = new Blob([JSON.stringify({ mode: m })], { type: "application/json" });
            if (navigator.sendBeacon) { navigator.sendBeacon("/api/live/ping", blob); return; }
        } catch { }
        fetch("/api/live/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) })
            .catch(() => { });
    };

    // timer
    useEffect(() => {
        if (mode !== "running" || paused) return;
        setStartTs(performance.now());
        tickRef.current = setInterval(() => {
            setElapsedMs(prev => prev + 1000);
        }, 1000);
        livePing("grammar");
        const iv = setInterval(() => livePing("grammar"), 10000);
        return () => { clearInterval(tickRef.current); clearInterval(iv); };
    }, [mode, paused]);

    // Auto-pause on blur/hidden; resume on focus
    useEffect(() => {
        if (mode !== "running") return;
        const onBlur = () => setPaused(true);
        const onFocus = () => setPaused(false);
        const onVis = () => setPaused(document.visibilityState === "hidden");
        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVis);
        return () => {
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [mode]);

    // Focus mode: hide navbar while running
    useEffect(() => {
        try {
            if (mode === "running") {
                document.body.dataset.quizmode = "1";
            } else {
                delete document.body.dataset.quizmode;
            }
        } catch { }
    }, [mode]);

    // deep-link start (?concept=...&subTopic=...&start=1 or ?start=Concept|Sub)
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
        if (!bank || !bank[c] || !bank[c][s]) return;
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

    // -------------- helpers --------------
    const saveSession = (payload) => {
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch { }
    };
    const clearSession = () => {
        try { localStorage.removeItem(SESSION_KEY); } catch { }
    };
    const mmss = (ms) => {
        const s = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${String(r).padStart(2, "0")}`;
    };

    // -------------- start quiz --------------
    async function startQuizFrom(c, s, diff = difficulty, n = count) {
        isAiRef.current = false;
        setElapsedMs(0);
        setHintsUsed(0);
        setHiddenChoices(new Set());
        setSelected(null);
        setRevealed(false);
        setCorrectSoFar(0);
        setQIndex(0);

        // AI path (optional)
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
                            saveSession({ concept: c, subTopic: s, items, index: 0, correct: 0, elapsed: 0 });
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
                    saveSession({ concept: c, subTopic: s, items: j.items, index: 0, correct: 0, elapsed: 0 });
                    return;
                } else {
                    setAiMsg(
                        r.status === 429
                            ? (j?.error || "AI is rate-limited; using built-in questions.")
                            : (j?.error || "AI generator returned no questions.")
                    );
                }
            } catch {
                setAiMsg("AI generator error. Using built-in questions.");
            } finally {
                setAiLoading(false);
            }
        }

        // Built-in bank fallback (or default)
        const q = buildQuiz({ concept: c, subTopic: s, difficulty: diff, count: n, allowShort: false, seed: Date.now() % 100000 });
        if (!q.items?.length) return alert("Not enough questions yet in this area.");
        setQuiz(q);
        setResult(null);
        setMode("running");
        saveSession({ concept: q.concept, subTopic: q.subTopic, items: q.items, index: 0, correct: 0, elapsed: 0 });
    }

    // -------------- per-question handlers --------------
    const cur = quiz?.items?.[qIndex] || null; // expected shape: { prompt, choices:[], answerIndex, explanation? }

    const onChoose = (idx) => {
        if (revealed) return;
        setSelected(idx);
        // track selection for review
        const arr = answersRef.current.slice();
        arr[qIndex] = idx;
        answersRef.current = arr;
    };

    const onReveal = () => {
        if (revealed || selected == null) return;
        const correct = Number(cur?.answerIndex) === Number(selected);
        setRevealed(true);
        if (correct) setCorrectSoFar((c) => c + 1);
        // persist progress
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            const s = raw ? JSON.parse(raw) : {};
            saveSession({
                ...(s || {}),
                index: qIndex,
                correct: (s?.correct ?? 0) + (correct ? 1 : 0),
                elapsed: elapsedMs,
                answers: answersRef.current,
            });
        } catch { }
    };

    const onNext = () => {
        if (!quiz) return;
        const last = qIndex >= (quiz.items.length - 1);
        if (last) {
            finishQuiz();
            return;
        }
        setQIndex(qIndex + 1);
        setSelected(null);
        setRevealed(false);
        setHiddenChoices(new Set());
    };

    const onHint = () => {
        if (!cur?.choices?.length || revealed) return;
        // simple "eliminate one wrong" hint — coerce answerIndex to number to avoid removing the correct one
        const ans = Number(cur?.answerIndex);
        const wrongs = cur.choices
            .map((_, i) => i)
            .filter(i => i !== ans && !hiddenChoices.has(i));
        if (!wrongs.length) return;
        const remove = wrongs[Math.floor(Math.random() * wrongs.length)];
        const ns = new Set(hiddenChoices);
        ns.add(remove);
        setHiddenChoices(ns);
        setHintsUsed(h => h + 1);
    };

    // -------------- finish --------------
    async function finishQuiz() {
        const total = quiz?.items?.length ?? 0;
        const numCorrect = correctSoFar + (
            revealed && selected != null && Number(cur?.answerIndex) === Number(selected) && qIndex === total - 1 ? 1 : 0
        );
        const durationMs = elapsedMs; // elapsedMs counts seconds
        const scorePct = total ? Math.round((numCorrect / total) * 100) : 0;

        const summary = { scorePct, numCorrect, total, durationMs, hintsUsed, answers: answersRef.current.slice() };
        setResult(summary);
        setMode("results");
        clearSession();

        try {
            await fetch("/api/grammarprogress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    concept: quiz.concept,
                    subTopic: quiz.subTopic,
                    score: scorePct,
                    numQuestions: total,
                    durationMs,
                    isAi: !!isAiRef.current,
                    hintsUsed: Math.max(0, Math.round(hintsUsed || 0)),
                }),
            });
        } catch { /* no-op */ }
    }

    function resetToLanding() {
        setMode("landing");
        setQuiz(null);
        setResult(null);
        setSelected(null);
        setRevealed(false);
        setCorrectSoFar(0);
        setQIndex(0);
        setElapsedMs(0);
        setHintsUsed(0);
        setHiddenChoices(new Set());
        setPaused(false);
        answersRef.current = [];
        clearSession();
    }

    // Keyboard shortcuts during running mode
    useEffect(() => {
        if (mode !== "running") return;
        const onKey = (e) => {
            // numbers 1-9 choose option
            if (!revealed && /^[1-9]$/.test(e.key)) {
                const idx = Number(e.key) - 1;
                if (idx >= 0 && idx < (cur?.choices?.length || 0)) onChoose(idx);
            } else if (e.key === "Enter") {
                if (!revealed && selected != null) onReveal();
                else if (revealed) onNext();
            } else if (e.key === "h" || e.key === "H") {
                onHint();
            } else if (e.key === "Escape") {
                if (confirm("Exit the quiz and return to start?")) resetToLanding();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [mode, revealed, selected, cur]);


    // -------------- notes --------------
    async function saveGrammarNote(payload) {
        try {
            if (!noteData) return;
            const res = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType: payload?.targetType || "grammar",
                    concept: noteData.concept,
                    subTopic: noteData.subTopic,
                    promptHash: noteData.promptHash,
                    anchorText: noteData.anchorText || "",
                    body: payload.body,
                    tags: payload.tags,
                    color: payload.color,
                    isBookmark: !!payload.isBookmark,
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

    // -------------------------- RENDER --------------------------

    // landing / resume UI
    if (mode === "landing" || mode === "resume") {
        return (
            <main className={styles.singleColumn}>
                {/* Content card (full-width center) */}
                <section className={styles.content}>
                    <div className={styles.card} style={{ width: "100%", maxWidth: 820 }}>
                        <h2 className={styles.cardTitle}>Start a grammar quiz</h2>
                        <p className={styles.dim} style={{ marginTop: 6 }}>
                            Pick a concept and subtopic, then press <strong>Start</strong>.
                            {mode === "resume" && " You have an unfinished session — you can resume or start fresh."}
                        </p>
                        <div className={styles.quickLinksRow}>
                            <a className={styles.sidebarLink} href="/dashboard#panel-grammar">Dashboard → Grammar</a>
                            <span aria-hidden="true" className={styles.dotSep}>•</span>
                            <a className={styles.sidebarLink} href="/library">Library</a>
                        </div>

                        <div className={styles.formGrid}>
                            <label className={styles.formLabel}>
                                Concept
                                <select
                                    className={styles.input}
                                    value={concept}
                                    onChange={(e) => setConcept(e.target.value)}
                                >
                                    {concepts.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>

                            <label className={styles.formLabel}>
                                Subtopic
                                <select
                                    className={styles.input}
                                    value={subTopic}
                                    onChange={(e) => setSubTopic(e.target.value)}
                                >
                                    {subTopics.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>

                            <label className={styles.formLabel}>
                                Difficulty
                                <select
                                    className={styles.input}
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                >
                                    <option value="mixed">Mixed</option>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </label>

                            <label className={styles.formLabel}>
                                # Questions
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={3}
                                    max={30}
                                    value={count}
                                    onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value) || 10)))}
                                />
                            </label>
                        </div>

                        {currentBadge && (
                            <div className={styles.metaRow}>
                                <span>Latest: <strong>{currentBadge.latest ?? "—"}%</strong></span>
                                <span style={{ marginLeft: 8, opacity: .7 }}>Attempts: {currentBadge.attempts ?? 0}</span>
                            </div>
                        )}

                        {/* Recommended grid (clean cards) */}
                        <div className={styles.sectionHeader}>Recommended for you</div>
                        {recLoading && <div className={styles.dim}>Loading suggestions…</div>}
                        {recErr && <div className={styles.badgeWarn}>⚠ {recErr}</div>}
                        {!recLoading && !recErr && (
                            <div className={styles.recGrid}>
                                {((recs && recs.length ? recs : fallback) || [])
                                    .slice(0, 6)
                                    .map((r, i) => {
                                        const attempts = r.attempts ?? 0;
                                        const last = Number.isFinite(r.recentScore) ? Math.round(r.recentScore) : null;
                                        const weakish = (r.weakness ?? 0) > 0;
                                        const reason =
                                            attempts === 0
                                                ? "You haven’t tried this yet."
                                                : weakish && last != null
                                                    ? `Your last score was ${last}%.`
                                                    : weakish
                                                        ? "You missed questions here recently."
                                                        : last != null
                                                            ? `Last score: ${last}%.`
                                                            : "Good for a quick review.";
                                        return (
                                            <button
                                                key={`${r.concept}:::${r.subTopic}:::${i}`}
                                                className={styles.recCard}
                                                onClick={() => {
                                                    setConcept(r.concept);
                                                    setSubTopic(r.subTopic);
                                                    setTimeout(() => startQuizFrom(r.concept, r.subTopic), 20);
                                                }}
                                                aria-label={`Practice ${r.concept} — ${r.subTopic}`}
                                            >
                                                <div className={styles.recTitleBlock}>
                                                    <div className={styles.recCardMain}>{r.subTopic}</div>
                                                    <div className={styles.recCardSub}>{r.concept}</div>
                                                </div>
                                                <div className={styles.recCardReason}>{reason}</div>
                                                <div className={styles.recCardCta}>Practice</div>
                                            </button>
                                        );
                                    })}
                            </div>
                        )}


                        {/* Optional AI controls */}
                        <div className={styles.controlsRow}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                    type="checkbox"
                                    checked={aiMode}
                                    onChange={(e) => setAiMode(e.target.checked)}
                                />
                                Use AI generator
                            </label>
                            <input
                                className={styles.input}
                                placeholder="(Optional) Provide source text for AI…"
                                value={aiText}
                                onChange={(e) => setAiText(e.target.value)}
                                disabled={!aiMode}
                                style={{ flex: 1 }}
                            />
                        </div>
                        {aiMsg && <div className={styles.badgeWarn} style={{ marginTop: 6 }}>⚠ {aiMsg}</div>}

                        <div className={styles.controlsRow}>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => startQuizFrom(concept, subTopic)}
                                disabled={aiMode && aiLoading}
                            >
                                {aiMode && aiLoading ? "Starting…" : "Start"}
                            </button>

                            {mode === "resume" && (
                                <>
                                    <button className={styles.btn} onClick={() => startQuizFrom(concept, subTopic)}>
                                        Resume saved session
                                    </button>
                                    <button className={styles.btn} onClick={resetToLanding}>
                                        Discard saved session
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                </section>
            </main>
        );
    }

    // running UI
    if (mode === "running") {
        const total = quiz?.items?.length ?? 0;
        const isLast = qIndex === total - 1;
        const answeredCorrect = revealed && selected != null && Number(cur?.answerIndex) === Number(selected);
        const pct = total ? Math.round(((qIndex + (revealed ? 1 : 0)) / total) * 100) : 0;

        return (
            <main style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
                {/* slim progress bar */}
                <div style={{ height: 4, background: "#eee", borderRadius: 9999, overflow: "hidden" }} aria-hidden="true">
                    <div style={{ width: `${pct}%`, height: 4, background: "#3b82f6" }} />
                </div>
                <div className={styles.runnerTop}>
                    <h2 style={{ margin: 0 }}>{quiz?.concept} — {quiz?.subTopic}</h2>
                    <div className={styles.topMeta}>
                        <span>Q {qIndex + 1} / {total}</span>
                        <span>Time {mmss(elapsedMs)}{paused ? " (paused)" : ""}</span>
                        <span>Score {correctSoFar + (answeredCorrect ? 1 : 0)} / {total}</span>
                    </div>
                </div>
                {paused && (
                    <div className={styles.badgeWarn} role="status" style={{ marginBottom: 8 }}>
                        Paused — click anywhere or press Enter to resume.
                    </div>
                )}

                {/* prompt */}
                <div className={styles.card} style={{ marginTop: 8 }}>
                    <div className={styles.reviewPrompt} style={{ marginBottom: 8 }}>
                        {cur?.prompt || "Question text"}
                    </div>

                    {/* choices */}
                    <div style={{ display: "grid", gap: 8 }}>
                        {(cur?.choices || []).map((c, i) => {
                            const hidden = hiddenChoices.has(i);
                            const isSel = selected === i;
                            const isAns = cur?.answerIndex === i;
                            const showGood = revealed && isSel && isAns;
                            const showBad = revealed && isSel && !isAns;
                            const showCorrect = revealed && !isSel && isAns;
                            return (
                                <button
                                    key={i}
                                    className={styles.choiceBtn}
                                    onClick={() => onChoose(i)}
                                    disabled={revealed || hidden}
                                    style={{
                                        opacity: hidden ? 0.4 : 1,
                                        borderColor: showGood ? "#a7f3d0" : showBad ? "#fecaca" : isSel ? "#c9d7fb" : "#ddd",
                                        background: showGood ? "#ecfdf5" : showBad ? "#fef2f2" : isSel ? "#f7f8fb" : "#fff"
                                    }}
                                >
                                    {c}
                                    {showCorrect && <span className={styles.good} style={{ marginLeft: 8 }}>Correct</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* actions */}
                    <div className={styles.controlsRow}>
                        <button className={styles.btn} onClick={onHint} disabled={revealed || (cur?.choices?.length - hiddenChoices.size) <= 2}>
                            Hint (eliminate one)
                        </button>
                        <button className={styles.btnPrimary} onClick={onReveal} disabled={revealed || selected == null}>
                            Check
                        </button>
                        <button className={styles.btn} onClick={onNext} disabled={!revealed}>
                            {isLast ? "Finish" : "Next"}
                        </button>
                        <button
                            className={styles.linkBtn}
                            onClick={() => {
                                setNoteData({
                                    concept: quiz?.concept,
                                    subTopic: quiz?.subTopic,
                                    anchorText: cur?.prompt || "",
                                    promptHash: String(qIndex + 1),
                                });
                            }}
                            style={{ marginLeft: "auto" }}
                        >
                            + Add note
                        </button>
                    </div>

                    {/* explanation */}
                    {revealed && cur?.explanation && (
                        <div className={styles.reviewExpl} style={{ marginTop: 8 }}>
                            {cur.explanation}
                        </div>
                    )}
                </div>

                {/* Notes modal (single modal; use component’s own backdrop) */}
                <NotesModal
                    open={!!noteData}
                    seed={{ anchorText: noteData?.anchorText }}
                    onClose={() => setNoteData(null)}
                    onSave={saveGrammarNote}
                    initialType="grammar"
                />

                <div className={styles.controlsRow}>
                    <button
                        className={styles.btn}
                        onClick={() => {
                            if (confirm("Exit the quiz and return to start? Your progress in this run will be lost.")) {
                                resetToLanding();
                            }
                        }}
                    >
                        Exit
                    </button>
                </div>
            </main>
        );
    }

    // results UI
    if (mode === "results") {
        const total = result?.total ?? 0;
        return (
            <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
                <div className={styles.card}>
                    <h2 className={styles.cardTitle} style={{ marginBottom: 6 }}>Results</h2>
                    <div className={styles.reviewCols}>
                        <div><strong>Score:</strong> {result?.numCorrect} / {total} ({result?.scorePct}%)</div>
                        <div><strong>Time:</strong> {mmss(result?.durationMs || 0)}</div>
                        <div><strong>Hints:</strong> {result?.hintsUsed ?? 0}</div>
                    </div>
                    <div className={styles.controlsRow}>
                        <button className={styles.btnPrimary} onClick={resetToLanding}>Back to start</button>
                        <button className={styles.btn} onClick={() => startQuizFrom(quiz?.concept, quiz?.subTopic)}>Retry same topic</button>
                    </div>
                </div>

                {/* review list */}
                <div className={styles.card} style={{ marginTop: 12 }}>
                    <div className={styles.cardTitle}>Review</div>
                    <div className={styles.reviewList}>
                        {(quiz?.items || []).map((it, i) => {
                            // We don't store per-question user answers post-finish in this simplified runner.
                            // If you want exact selections, persist them in session and carry to results.
                            return (
                                <div key={i} className={styles.reviewRow}>
                                    <div className={styles.reviewPrompt}>{it.prompt}</div>
                                    <div className={styles.reviewCols}>
                                        <div>
                                            Correct: <span className={styles.good}>{it.choices?.[it.answerIndex]}</span>
                                        </div>
                                        {Array.isArray(result?.answers) && Number.isInteger(result.answers[i]) && (
                                            <div>
                                                You chose:&nbsp;
                                                <span className={result.answers[i] === it.answerIndex ? styles.good : styles.bad}>
                                                    {it.choices?.[result.answers[i]] ?? "—"}
                                                </span>
                                            </div>
                                        )}
                                        {it.explanation && (
                                            <div className={styles.reviewExpl}>{it.explanation}</div>
                                        )}
                                    </div>
                                    <button
                                        className={styles.linkBtn}
                                        onClick={() => setNoteData({
                                            concept: quiz?.concept,
                                            subTopic: quiz?.subTopic,
                                            anchorText: it.prompt || "",
                                            promptHash: String(i + 1),
                                        })}
                                    >
                                        + Add note
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <NotesModal
                    open={!!noteData}
                    seed={{ anchorText: noteData?.anchorText }}
                    onClose={() => setNoteData(null)}
                    onSave={saveGrammarNote}
                    initialType="grammar"
                />
            </main>
        );
    }

    // fallback
    return (
        <main style={{ maxWidth: 820, margin: "32px auto", padding: 16 }}>
            <h2>Loading…</h2>
        </main>
    );
}
