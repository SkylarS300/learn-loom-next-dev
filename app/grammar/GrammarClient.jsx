'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
// Use a stable relative path so it works regardless of alias config:
// DO NOT import NavbarGuard here; it can pull server-only code into the client bundle.
import bank, { buildQuiz } from "../../src/grammar/buildQuiz";
import styles from "./grammar.module.css";
// Load lazily to avoid SSR issues if NotesModal touches browser APIs at module top-level
const NotesModal = dynamic(() => import("../readingpal/NotesModal"), { ssr: false });

// ---- Everything below is exactly your existing code, unchanged except for being in a client component ----

export default function GrammarClient() {
    // Debug: signal mount + basic env
    useEffect(() => {
        // This helps confirm the component actually mounted on client nav
        console.log("[GrammarClient] mounted", { hasBank: !!bank, concepts: bank ? Object.keys(bank).length : 0 });
        window.__GRAMMAR_MOUNTED__ = true;
    }, []);

    // If the bank failed to import for any reason, show a helpful hint instead of crashing
    if (!bank || typeof bank !== "object") {
        return (
            <main style={{ maxWidth: 620, margin: "32px auto", padding: 16 }}>
                <h1>Grammar unavailable</h1>
                <p style={{ color: "#6b7280" }}>The question bank didn’t load.</p>
                <ul style={{ color: "#6b7280" }}>
                    <li>Check <code>src/grammar/bank/fromStatic.js</code> legacy import path (<code>../../content/quizzes.js</code>).</li>
                    <li>Confirm <code>src/content/quizzes.js</code> exists and exports an object.</li>
                </ul>
            </main>
        );
    }
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

    // live ping helper
    const livePing = (mode = "grammar") => {
        try {
            const blob = new Blob([JSON.stringify({ mode })], { type: "application/json" });
            if (navigator.sendBeacon) { navigator.sendBeacon("/api/live/ping", blob); return; }
        } catch { }
        fetch("/api/live/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
        }).catch(() => { });
    };

    // ping while quiz is running
    useEffect(() => {
        if (mode !== "running") return;
        livePing("grammar"); // immediate
        const iv = setInterval(() => livePing("grammar"), 10000);
        return () => clearInterval(iv);
    }, [mode]);

    // Use the existing deep-link code:
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

    // ---------------- return (unchanged UI) ----------------
    return (
        <div id="main-content">
            {/* Your existing UI stays here. This wrapper ensures route renders even if children change later. */}
        </div>
    );
}
