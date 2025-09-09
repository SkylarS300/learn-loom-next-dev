"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import books from "../../src/content/book-content.js";
import styles from "./readingpal.module.css";
import NotesModal from "../components/NotesModal";
import NotesSidePanel from "./NotesSidePanel";
import VocabPanel from "./VocabPanel";
import PronouncePractice from "./PronouncePractice";
import { toLemma, detectPOS } from "./word-utils";
import { analyzeCEFR } from "@/src/cefr/analyzeText";
import LookupBubble from "./LookupBubble";


/* ------- helpers ------- */

// convert HEX like #F59E0B -> rgba(r,g,b,a)
function hexToRgba(hex = "#FDE047", a = 0.45) {
  try {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch { return "rgba(253,224,71,0.45)"; }
}

function saveBookmark({ type, id, chapterIndex, scrollY }) {
  const key = `bookmark-${type}-${id}`;
  localStorage.setItem(
    key,
    JSON.stringify({ type, id, chapterIndex, scrollY, timestamp: Date.now() })
  );
}
function getBookmark(type, id) {
  const raw = localStorage.getItem(`bookmark-${type}-${id}`);
  return raw ? JSON.parse(raw) : null;
}
function clearBookmark(type, id) {
  localStorage.removeItem(`bookmark-${type}-${id}`);
}
function throttledScrollSave(key, container) {
  clearTimeout(throttledScrollSave.t);
  throttledScrollSave.t = setTimeout(() => {
    if (container) localStorage.setItem(key, String(container.scrollTop));
  }, 200);
}
function applySavedScroll(key, container) {
  const saved = localStorage.getItem(key);
  if (saved && container) {
    container.scrollTop = parseInt(saved, 10);
    const toast = document.createElement("div");
    toast.textContent = "Resumed from last scroll position";
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#333",
      color: "#fff",
      padding: "10px 20px",
      borderRadius: "8px",
      zIndex: "9999",
      fontSize: "14px",
      opacity: "0.9",
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }
}
function getAnonId() {
  const match = document.cookie.split("; ").find((r) => r.startsWith("learnloomId="));
  return match?.split("=")[1] || null;
}
function settingsKey(anonId) {
  return `ttsPrefs:${anonId || "anon"}`;
}
function loadPrefs(anonId) {
  try {
    const raw = localStorage.getItem(settingsKey(anonId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function savePrefs(anonId, prefs) {
  try { localStorage.setItem(settingsKey(anonId), JSON.stringify(prefs)); } catch { }
}

export default function ReadingPalClient() {
  const searchParams = useSearchParams();
  const uploadId = searchParams.get("upload");
  const bookIndex = searchParams.get("bookIndex");
  const resumeFlag = searchParams.get("resume") === "1";
  const initialChapterParam = Number(searchParams.get("chapterIndex"));
  const anonId = typeof window !== "undefined" ? getAnonId() : null;

  const [uploadData, setUploadData] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [bookmark, setBookmark] = useState(null);          // local scroll bookmark
  const [serverBookmark, setServerBookmark] = useState(null); // server-side (chapter/sentence)
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSeed, setNoteSeed] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0); // for re-render & side panel props
  // sentenceIndex -> color (for note decorations)
  const noteMapRef = useRef({}); // { [idx:number]: string(hex) }
  const [vocab, setVocab] = useState({ word: "", lemma: "", pos: "", cefr: "", def: "", ex: "" });
  const [showPronounce, setShowPronounce] = useState(false);
  const [ctx, setCtx] = useState(null); // {x,y,selection}
  const currentBookRef = useRef(null);
  const chapterIndexRef = useRef(0);

  const textRef = useRef(null);
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);
  const spansRef = useRef([]); // cache current chapter sentence spans
  const scrollHandlerRef = useRef(null);


  const readingRef = useRef(false);
  const sentenceIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const utteranceRef = useRef(null);

  const sessionIdRef = useRef(0);
  const lastTickRef = useRef(0);
  const postTimerRef = useRef(null);

  const highlightedColorRef = useRef("yellow");
  const hlColorKey = `rpHighlightColor:${anonId || "anon"}`;

  // close context menu on click elsewhere/escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (ctx) setCtx(null);
    };
    const onEsc = (e) => { if (e.key === "Escape") setCtx(null); };
    document.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [ctx]);

  // fire-and-forget ping (uses sendBeacon when available)
  function livePing(mode = "reading") {
    try {
      const blob = new Blob([JSON.stringify({ mode })], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon("/api/live/ping", blob)) return;
    } catch { }
    fetch("/api/live/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => { });
  }

  // ------- tiny toast helper (non-blocking) -------
  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#111827",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "8px",
      zIndex: "9999",
      fontSize: "14px",
      opacity: "0.95",
      boxShadow: "0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)"
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  // show one-time keyboard hint
  useEffect(() => {
    try {
      const k = "rpHintV1";
      if (!localStorage.getItem(k)) {
        setShowHint(true);
        localStorage.setItem(k, "1");
      }
    } catch { }
  }, []);

  // --- helpers for lookup/translate ---
  function currentSelection() {
    const t = window.getSelection?.().toString().trim() || "";
    return t.replace(/\s+/g, " ").slice(0, 64);
  }
  async function doDefine(text) {
    const q = text || currentSelection();
    if (!q) return;
    try {
      const lemma = toLemma(q);
      const pos = detectPOS(q);
      const r = await fetch("/api/define", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: q })
      });
      const j = await r.json();
      const def = j?.ok ? (j.definition || "") : "";
      const ex = j?.example || "";
      setVocab((v) => ({ ...v, word: q, lemma, pos, def, ex }));
    } catch { /* no-op */ }
  }
  async function doTranslate(text) {
    const q = text || currentSelection();
    if (!q) return;
    try {
      const r = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q })
      });
      const j = await r.json();
      toast(j?.ok ? `ⓘ ${q} → ${j.translation}` : (j?.error || "Translate unavailable"));
    } catch { toast("⚠️ Translate unavailable"); }
  }
  async function addToVocab(text) {
    const q = text || currentSelection();
    if (!q) return;
    try {
      await fetch("/api/vocab/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: q, lemma: toLemma(q) })
      });
      toast("⭐ Added to vocabulary");
    } catch { toast("⚠️ Could not add"); }
  }


  // ------- Server bookmark helpers (books only, not uploads) -------
  async function saveServerBookmark() {
    try {
      if (!anonId || uploadId) return; // uploads remain local-only
      const bIdx = Number(bookIndex);
      const cIdx = chapterIndexRef.current;
      if (!Number.isInteger(bIdx) || !Number.isInteger(cIdx)) return;
      await fetch("/api/reading/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIndex: bIdx,
          chapterIndex: cIdx,
          sentenceIndex: Number(sentenceIndexRef.current) || 0,
        }),
      });
      setServerBookmark({ sentenceIndex: Number(sentenceIndexRef.current) || 0 });
      toast(`🔖 Saved: Chapter ${cIdx + 1}, Sentence ${Number(sentenceIndexRef.current) + 1}`);
    } catch {
      toast("⚠️ Couldn't save bookmark");
    }
  }

  async function loadServerBookmark(autoJump = false) {
    try {
      if (!anonId || uploadId) return;
      const bIdx = Number(bookIndex);
      const cIdx = chapterIndexRef.current;
      if (!Number.isInteger(bIdx) || !Number.isInteger(cIdx)) return;
      const r = await fetch(`/api/reading/bookmark?bookIndex=${bIdx}&chapterIndex=${cIdx}`, { cache: "no-store" });
      const j = await r.json();
      const idx = j?.data?.sentenceIndex;
      if (Number.isInteger(idx)) {
        setServerBookmark({ sentenceIndex: idx });
        if (autoJump && textRef.current) {
          sentenceIndexRef.current = idx;
          setHighlight(idx);
          const spans = Array.from(textRef.current.querySelectorAll(`.${styles.sentence}`));
          if (spans[idx]) spans[idx].scrollIntoView({ behavior: "smooth", block: "center" });
          setResumePromptOpen(false);
        } else {
          setResumePromptOpen(true); // show the “Resume?” bar once per chapter load
        }
      } else {
        setServerBookmark(null);
        setResumePromptOpen(false);
      }
    } catch {
      toast("⚠️ Couldn't load bookmark");
    }
  }

  /* ---------- voices + prefs ---------- */
  useEffect(() => {
    async function ensureVoicesReady() {
      const ss = window.speechSynthesis;
      // Wait briefly for Chrome to populate voices after first interaction
      for (let i = 0; i < 20; i++) {
        const v = ss.getVoices();
        if (v.length) return v;
        await new Promise((r) => setTimeout(r, 50));
      }
      return ss.getVoices();
    }

    async function loadVoices() {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        toast("⚠️ Text‑to‑speech is not available in this browser.");
        return;
      }
      const v = await ensureVoicesReady();
      if (v.length) {
        setVoices(v);
        // Respect stored voice if available; else pick a sensible default
        const p = loadPrefs(anonId);
        const byPref = p?.voiceName ? v.find((vv) => vv.name === p.voiceName) : null;
        const fallback = v.find((vv) => vv.lang?.startsWith("en") && vv.name?.includes("Female")) || v[0];
        setSelectedVoice(byPref || fallback || null);
      }
    }
    loadVoices();
    const ss = window.speechSynthesis;
    const prev = ss.onvoiceschanged;
    ss.onvoiceschanged = loadVoices;

    const p = loadPrefs(anonId);
    if (p) {
      if (typeof p.rate === "number") setRate(p.rate);
      if (typeof p.pitch === "number") setPitch(p.pitch);
      if (typeof p.volume === "number") setVolume(p.volume);
      if (typeof p.autoAdvance === "boolean") setAutoAdvance(p.autoAdvance);
    }
    // Highlight color (polish): restore last picked color
    try {
      const savedColor = localStorage.getItem(hlColorKey);
      if (savedColor) highlightedColorRef.current = savedColor;
    } catch { }
    return () => {
      if (ss) ss.onvoiceschanged = prev || null;
    };
  }, []); // eslint-disable-line

  // Flush time when tab hides or page unloads (prevents time loss)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && readingRef.current) {
        // conservative flush (no sentence change)
        const now = performance.now();
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;
        const bIdx = Number(bookIndex);
        const cIdx = chapterIndexRef.current;
        if (anonId && Number.isInteger(bIdx) && Number.isInteger(cIdx)) {
          fetch("/api/readingprogress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookIndex: bIdx,
              chapterIndex: cIdx,
              sentenceIndex: sentenceIndexRef.current,
              deltaTimeMs: Math.max(0, Math.round(dt)),
            }),
          }).catch(() => { });
          // also ping live
          livePing("reading");
        }
      }
    };
    const handleBeforeUnload = () => {
      if (!readingRef.current) return;
      const now = performance.now();
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const bIdx = Number(bookIndex);
      const cIdx = chapterIndexRef.current;
      if (anonId && Number.isInteger(bIdx) && Number.isInteger(cIdx)) {
        navigator.sendBeacon?.(
          "/api/readingprogress",
          new Blob(
            [JSON.stringify({
              bookIndex: bIdx,
              chapterIndex: cIdx,
              sentenceIndex: sentenceIndexRef.current,
              deltaTimeMs: Math.max(0, Math.round(dt)),
            })],
            { type: "application/json" }
          )
        );
        // final ping
        try {
          navigator.sendBeacon?.(
            "/api/live/ping",
            new Blob([JSON.stringify({ mode: "reading" })], { type: "application/json" })
          );
        } catch { }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [anonId, bookIndex]);


  useEffect(() => {
    savePrefs(anonId, { rate, pitch, volume, autoAdvance, voiceName: selectedVoice?.name });
  }, [anonId, rate, pitch, volume, autoAdvance, selectedVoice]);

  // reselect voice by name if prefs had it
  useEffect(() => {
    const p = loadPrefs(anonId);
    if (!voices.length) return;
    const prefName = p?.voiceName || selectedVoice?.name;
    if (!prefName) return;
    const found = voices.find((v) => v.name === prefName);
    if (found && (!selectedVoice || selectedVoice.name !== found.name)) {
      setSelectedVoice(found);
    }
  }, [voices]); // eslint-disable-line

  /* ---------- font slider ---------- */
  useEffect(() => {
    const input = fontSizeRef.current;
    const text = textRef.current;
    const handler = (e) => { if (text) text.style.fontSize = e.target.value + "px"; };
    input?.addEventListener("input", handler);
    return () => input?.removeEventListener("input", handler);
  }, []);

  /* ---------- initial load ---------- */
  useEffect(() => {
    (async () => {
      if (uploadId) {
        try {
          const r = await fetch(`/api/uploads/${uploadId}`);
          const data = await r.json();
          setUploadData(data);
        } catch {
          toast("⚠️ Failed to load upload");
          return;
        }

        if (bookTitleRef.current) bookTitleRef.current.innerText = data.title;
        if (chapterTitleRef.current) chapterTitleRef.current.innerText = "Uploaded Text";
        if (textRef.current) {
          textRef.current.innerText = data.content || "";
          wrapSentences(textRef.current);
          const key = `scroll_upload_${uploadId}`;
          // Replace any previous scroll handler to avoid duplicates
          if (scrollHandlerRef.current && textRef.current) {
            textRef.current.removeEventListener("scroll", scrollHandlerRef.current);
          }
          const h = () => throttledScrollSave(key, textRef.current);
          // remove any previous handler before attaching a new one
          if (scrollHandlerRef.current && textRef.current) {
            textRef.current.removeEventListener("scroll", scrollHandlerRef.current);
          }
          scrollHandlerRef.current = h;
          textRef.current.addEventListener("scroll", h);
          setTimeout(() => applySavedScroll(key, textRef.current), 80);
          if (fontSizeRef.current) {
            textRef.current.style.fontSize = fontSizeRef.current.value + "px";
          }
        }
        const b = getBookmark("upload", uploadId);
        if (b) setBookmark(b);
      } else if (bookIndex !== null && bookTitleRef.current) {
        currentBookRef.current = books[parseInt(bookIndex)];
        // honor deep-linked chapterIndex if provided
        if (Number.isInteger(initialChapterParam) && initialChapterParam >= 0) {
          chapterIndexRef.current = initialChapterParam;
        }
        bookTitleRef.current.innerText =
          `${currentBookRef.current.title} by ${currentBookRef.current.author}`;
        await displayChapter(currentBookRef.current, chapterIndexRef.current); const b = getBookmark("book", bookIndex);
        if (b) setBookmark(b);
      }

      try {
        const r = await fetch("/api/uploadedtext");
        const j = await r.json();
        setUploads(Array.isArray(j) ? j : j?.data ?? []);
      } catch {
        toast("⚠️ Failed to load your uploads");
      }
    })();

    // chapter nav
    const prev = prevChapterRef.current;
    const next = nextChapterRef.current;
    const goPrev = () => {
      if (chapterIndexRef.current > 0 && currentBookRef.current) {
        // autosave bookmark before leaving
        saveServerBookmark();
        stopReading();
        chapterIndexRef.current--;
        displayChapter(currentBookRef.current, chapterIndexRef.current);
      }
    };
    const goNext = () => {
      if (
        currentBookRef.current &&
        chapterIndexRef.current < currentBookRef.current.chapters.length - 1
      ) {
        // autosave bookmark before leaving
        saveServerBookmark();
        stopReading();
        chapterIndexRef.current++;
        displayChapter(currentBookRef.current, chapterIndexRef.current);
      }
    };
    prev?.addEventListener("click", goPrev);
    next?.addEventListener("click", goNext);

    return () => {
      prev?.removeEventListener("click", goPrev);
      next?.removeEventListener("click", goNext);
      clearTimeout(postTimerRef.current);
    };
  }, [bookIndex, uploadId]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const withShift = e.shiftKey;
      // Quick dictionary: Alt + D ⇒ select current word (or first word of current sentence)
      if ((e.key === "d" || e.key === "D") && e.altKey) {
        e.preventDefault();
        const sel = window.getSelection?.();
        const selected = String(sel?.toString() || "").trim();
        if (!selected) {
          // Select first word of the current sentence to trigger the Lookup bubble
          try {
            const spans = currentSpans();
            const idx = Math.min(sentenceIndexRef.current || 0, Math.max(spans.length - 1, 0));
            const span = spans[idx];
            if (span) {
              const tn = [...span.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
              if (tn) {
                const text = tn.textContent || "";
                const m = text.match(/[A-Za-z][A-Za-z'-]*/);
                if (m) {
                  const r = document.createRange();
                  r.setStart(tn, m.index);
                  r.setEnd(tn, m.index + m[0].length);
                  sel.removeAllRanges();
                  sel.addRange(r);
                }
              }
            }
          } catch { /* noop */ }
        }
        // LookupBubble will react to the selection
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (speechSynthesis.speaking && !speechSynthesis.paused) pauseReading();
          else if (speechSynthesis.paused) resumeReading();
          else speakSentencesFrom(sentenceIndexRef.current || 0);
          break;
        case "b":
        case "B":
          // quick bookmark save
          e.preventDefault();
          saveBookmark({
            type: uploadId ? "upload" : "book",
            id: uploadId || bookIndex,
            chapterIndex: uploadId ? undefined : chapterIndexRef.current,
            scrollY: textRef.current?.scrollTop || 0,
          });
          saveServerBookmark();
          break;
        case "r":
        case "R":
          // quick resume to server sentence if available
          if (serverBookmark && Number.isInteger(serverBookmark.sentenceIndex)) {
            e.preventDefault();
            const idx = serverBookmark.sentenceIndex;
            sentenceIndexRef.current = idx;
            setHighlight(idx);
            const spans = Array.from(textRef.current?.querySelectorAll(`.${styles.sentence}`) || []);
            if (spans[idx]) spans[idx].scrollIntoView({ behavior: "smooth", block: "center" });
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (withShift) {
            if (chapterIndexRef.current > 0 && currentBookRef.current) {
              stopReading();
              chapterIndexRef.current--;
              displayChapter(currentBookRef.current, chapterIndexRef.current);
            }
          } else {
            jumpToSentence(Math.max((sentenceIndexRef.current || 0) - 1, 0), true);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (withShift) {
            if (
              currentBookRef.current &&
              chapterIndexRef.current < currentBookRef.current.chapters.length - 1
            ) {
              stopReading();
              chapterIndexRef.current++;
              displayChapter(currentBookRef.current, chapterIndexRef.current);
            }
          } else {
            const spans = currentSpans();
            const last = Math.max(spans.length - 1, 0);
            jumpToSentence(Math.min((sentenceIndexRef.current || 0) + 1, last), true);
          }
          break;
        case "Escape":
          e.preventDefault();
          stopReading();
          break;
        case "n":
        case "N":
          // open note at current sentence
          e.preventDefault();
          {
            const spans = currentSpans();
            const idx = Math.min(sentenceIndexRef.current || 0, Math.max(spans.length - 1, 0));
            const anchorText = spans[idx]?.innerText?.trim().slice(0, 160) || "";
            openNoteAt(idx, anchorText);
          }
          break;
        case "d": case "D":
          // Define selection
          if (currentSelection()) { e.preventDefault(); doDefine(); }
          break;
        case "t": case "T":
          // Translate selection
          if (currentSelection()) { e.preventDefault(); doTranslate(); }
          break;
        case "g": case "G":
          // Add to vocab
          if (currentSelection()) { e.preventDefault(); addToVocab(); }
          break;
        case "p": case "P":
          if (currentSelection()) { e.preventDefault(); setShowPronounce(true); }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- display chapter ---------- */
  async function displayChapter(book, chapterIndex) {
    stopReading();
    const chapter = book.chapters[chapterIndex];
    chapterIndexRef.current = chapterIndex;
    setChapterIdx(chapterIndex); // trigger side panel re-render

    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) {
      textRef.current.innerText = chapter.content || "";
      wrapSentences(textRef.current);

      const key = `scroll_book_${bookIndex}_${chapterIndex}`;
      const h = () => throttledScrollSave(key, textRef.current);
      // remove any previous handler before attaching a new one
      if (scrollHandlerRef.current && textRef.current) {
        textRef.current.removeEventListener("scroll", scrollHandlerRef.current);
      }
      scrollHandlerRef.current = h;
      textRef.current.addEventListener("scroll", h);
      setTimeout(() => applySavedScroll(key, textRef.current), 80);
      if (fontSizeRef.current) {
        textRef.current.style.fontSize = fontSizeRef.current.value + "px";
      }
    }

    // Clear any stale note underlines from previous chapter.
    clearNoteDecorations();

    // Check if a server bookmark exists for this chapter.
    // If resume=1 is present, jump automatically; otherwise show the prompt.
    await loadServerBookmark(resumeFlag);

    // Load notes for current chapter and apply subtle underlines
    try {
      if (!uploadId && Number.isInteger(Number(bookIndex))) {
        const bIdx = Number(bookIndex);
        const r = await fetch(`/api/notes?scope=current&bookIndex=${bIdx}&chapterIndex=${chapterIndex}&fields=lite`, { cache: "no-store" });
        const j = await r.json();
        if (j?.ok && Array.isArray(j.data)) {
          // Build map: sentenceIndex -> color
          const nextMap = {};
          for (const n of j.data) {
            if (Number.isInteger(n?.sentenceIndex) && n?.color) {
              nextMap[n.sentenceIndex] = n.color;
            }
          }
          noteMapRef.current = nextMap;
          applyNoteDecorations(noteMapRef.current);
        } else {
          noteMapRef.current = {};
        }
      }
    } catch {
      // non-fatal
      noteMapRef.current = {};
    }
  }

  /* ---------- sentence wrapping & highlight ---------- */
  function wrapSentences(container) {
    const text = container.innerText || "";
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
    // Clear and rebuild safely without innerHTML
    container.textContent = "";
    const frag = document.createDocumentFragment();
    spansRef.current = [];
    for (let i = 0; i < sentences.length; i++) {
      const span = document.createElement("span");
      span.className = styles.sentence;
      span.setAttribute("data-index", String(i));
      span.textContent = sentences[i].trim() + " ";
      spansRef.current.push(span);
      frag.appendChild(span);
    }
    container.appendChild(frag);


    // lightweight CEFR annotate (non-blocking)
    try {
      const res = analyzeCEFR(text);
      // (optional) you could underline >level words here
    } catch { }
  }

  function currentSpans() {
    return spansRef.current || [];
  }

  function setHighlight(idx) {
    const spans = currentSpans();
    spans.forEach((sp) => {
      sp.classList.remove(styles.highlightedSentence);
      // clear only the active highlight; keep note underline boxShadow intact
      sp.style.backgroundColor = "";
    });
    const t = spans[idx];
    if (t) {
      t.classList.add(styles.highlightedSentence);
      t.style.backgroundColor = highlightedColorRef.current;
      // Scrolling is handled by jump/click callers to avoid duplicate calls
    }
  }

  // --- note decorations (subtle underline using box-shadow) ---
  function clearNoteDecorations() {
    currentSpans().forEach((sp) => { sp.style.boxShadow = ""; });
  }
  function applyNoteDecorations(map) {
    const spans = currentSpans();
    Object.entries(map || {}).forEach(([k, color]) => {
      const idx = Number(k);
      const sp = spans[idx];
      if (!sp) return;
      sp.style.boxShadow = `inset 0 -6px 0 ${hexToRgba(color, 0.5)}`;
      // small rounding so the underline feels pill-like when text wraps
      sp.style.borderRadius = "4px";
    });
  }


  function openNoteAt(idx, anchorText) {
    try {
      sentenceIndexRef.current = idx;
      setHighlight(idx);
    } catch { }
    const isUpload = !!uploadId;
    setNoteSeed({
      anchorText,
      defaultTags: [],
      defaultColor: "#F59E0B",
      isBookmark: false,
      // we keep anchors in outer scope when saving
    });
    setNoteOpen(true);
  }

  async function saveNote({ body, tags, color, isBookmark }) {
    if (!body?.trim()) return;
    setNoteSaving(true);
    try {
      const payload = {
        targetType: uploadId ? "upload" : "book",
        bookIndex: uploadId ? null : Number(bookIndex),
        uploadId: uploadId ? Number(uploadId) : null,
        chapterIndex: uploadId ? null : Number(chapterIndexRef.current || 0),
        sentenceIndex: Number(sentenceIndexRef.current || 0),
        wordIndex: null,
        anchorText: noteSeed?.anchorText || null,
        body: body.trim(),
        tags,
        color,
        isBookmark: !!isBookmark,
      };
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to save note");
      toast("✅ Note saved");
      setNoteOpen(false);
      // reflect decoration immediately
      try {
        const idx = Number(sentenceIndexRef.current || 0);
        if (Number.isInteger(idx) && color) {
          noteMapRef.current = { ...noteMapRef.current, [idx]: color };
          applyNoteDecorations(noteMapRef.current);
        }
      } catch { }
    } catch (e) {
      toast("⚠️ Could not save note");
    } finally {
      setNoteSaving(false);
    }
  }


  /* ---------- click‑to‑play ---------- */
  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    const clickHandler = (e) => {
      const span = e.target.closest(`.${styles.sentence}`);
      if (!span) return;
      const idx = Number(span.getAttribute("data-index"));
      if (!Number.isInteger(idx)) return;
      stopReading(); // cancel any queued speech
      setHighlight(idx);
      speakSentencesFrom(idx);
    };
    const dblHandler = (e) => {
      const span = e.target.closest(`.${styles.sentence}`);
      if (!span) return;
      const idx = Number(span.getAttribute("data-index"));
      if (!Number.isInteger(idx)) return;
      const sel = window.getSelection?.()?.toString().trim();
      const anchorText = sel || span.innerText.trim().slice(0, 160);
      openNoteAt(idx, anchorText);
    };

    const ctxHandler = (e) => {
      const sel = currentSelection();
      if (!sel) return; // let native menu if nothing selected
      e.preventDefault();
      setCtx({ x: e.clientX, y: e.clientY, selection: sel });
    };

    // Right-click (contextmenu): select the word under cursor so the Lookup bubble can appear
    const ctxHandler = (e) => {
      const rangeAtPoint = (node, offset) => {
        try {
          const r = document.createRange();
          r.setStart(node, offset);
          r.setEnd(node, offset);
          // expand to word boundaries
          const expand = () => {
            const txt = r.startContainer.textContent || "";
            let s = r.startOffset, eOff = r.endOffset;
            while (s > 0 && /[A-Za-z'-]/.test(txt[s - 1])) s--;
            while (eOff < txt.length && /[A-Za-z'-]/.test(txt[eOff])) eOff++;
            r.setStart(r.startContainer, s);
            r.setEnd(r.endContainer, eOff);
          };
          expand();
          return r;
        } catch { return null; }
      };
      try {
        const x = e.clientX, y = e.clientY;
        const caret = document.caretPositionFromPoint?.(x, y) || document.caretRangeFromPoint?.(x, y);
        let node, offset;
        if (caret) {
          if ("offsetNode" in caret) { node = caret.offsetNode; offset = caret.offset; }
          else { node = caret.startContainer; offset = caret.startOffset; }
        }
        if (node && node.nodeType === Node.TEXT_NODE) {
          const r = rangeAtPoint(node, offset);
          if (r) {
            e.preventDefault();
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            // LookupBubble listens to selectionchange and will show the bubble
          }
        }
      } catch { /* noop */ }
    };

    container.addEventListener("click", clickHandler);
    container.addEventListener("dblclick", dblHandler);
    container.addEventListener("contextmenu", ctxHandler);
    return () => {
      container.removeEventListener("click", clickHandler);
      container.removeEventListener("dblclick", dblHandler);
      container.removeEventListener("contextmenu", ctxHandler);
    };
  }, []); // handlers read from refs; no need to re-bind

  /* ---------- jump helper ---------- */
  function jumpToSentence(idx, start = false) {
    const spans = currentSpans();
    if (!spans.length) {
      toast("No sentences to read in this section.");
      return;
    }
    const clamped = Math.max(0, Math.min(idx, spans.length - 1));
    sentenceIndexRef.current = clamped;
    setHighlight(clamped);
    if (start) {
      stopReading();
      speakSentencesFrom(clamped);
    }
  }

  /* ---------- STOP/PAUSE/RESUME ---------- */
  function hardCancelSpeechQueue() {
    // Some engines queue utterances; ensure the queue is totally cleared
    try { speechSynthesis.cancel(); } catch { }
    utteranceRef.current = null;
  }
  function stopReading() {
    sessionIdRef.current += 1;
    readingRef.current = false;
    isPausedRef.current = false;
    clearTimeout(postTimerRef.current);
    // autosave on explicit stop
    saveServerBookmark();
    hardCancelSpeechQueue();
  }
  function pauseReading() {
    if (!isPausedRef.current && speechSynthesis.speaking) {
      speechSynthesis.pause();
      isPausedRef.current = true;
      // autosave on pause
      saveServerBookmark();
      // (Optional: you can flush time slice here if desired)
    }
  }
  function resumeReading() {
    if (isPausedRef.current && speechSynthesis.paused) {
      speechSynthesis.resume();
      isPausedRef.current = false;
      lastTickRef.current = performance.now();
    }
  }
  function startReading() {
    // Start from current highlighted sentence or 0
    const startAt = Number.isInteger(sentenceIndexRef.current)
      ? sentenceIndexRef.current
      : 0;
    setHighlight(startAt);
    stopReading();
    speakSentencesFrom(startAt);
  }

  /* ---------- REAL‑TIME SETTINGS: restart current sentence on change ---------- */
  useEffect(() => {
    if (!readingRef.current) return;
    // Re‑speak the current sentence with new settings immediately
    const idx = sentenceIndexRef.current || 0;
    stopReading();
    setHighlight(idx);
    speakSentencesFrom(idx);
  }, [selectedVoice, rate, pitch, volume]); // realtime

  // Resolve a fresh Voice object from the latest voices list by name (prevents stale Voice refs)
  function resolveSelectedVoice() {
    try {
      const ss = window.speechSynthesis;
      const live = (ss?.getVoices?.() || []);
      const list = live.length ? live : voices;
      const p = loadPrefs(anonId);
      const prefer = p?.voiceName || selectedVoice?.name;
      return (prefer && list.find((v) => v.name === prefer)) || selectedVoice || null;
    } catch { return selectedVoice || null; }
  }

  /* ---------- TTS core ---------- */
  function speakSentencesFrom(startIdx) {
    const spans = currentSpans();
    if (!spans.length) return;

    sentenceIndexRef.current = startIdx;
    readingRef.current = true;

    const mySession = ++sessionIdRef.current;
    lastTickRef.current = performance.now();

    const bIdx = Number(bookIndex);

    const flushDelta = (ms) => {
      if (!anonId) return;
      const cIdx = chapterIndexRef.current;
      if (!Number.isInteger(bIdx) || !Number.isInteger(cIdx)) return;
      fetch("/api/readingprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIndex: bIdx,
          chapterIndex: cIdx,
          sentenceIndex: sentenceIndexRef.current,
          deltaTimeMs: Math.max(0, Math.round(ms || 0)),
        }),
      }).catch(() => { });
    };

    const scheduleHeartbeat = () => {
      clearTimeout(postTimerRef.current);
      postTimerRef.current = setTimeout(() => {
        if (sessionIdRef.current !== mySession || !readingRef.current) return;
        const now = performance.now();
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;
        flushDelta(dt);
        // ping presence every slice
        livePing("reading");
        scheduleHeartbeat();
      }, 5000);
    };

    const speakNext = () => {

      const spansNow = currentSpans();
      if (!readingRef.current || sentenceIndexRef.current >= spansNow.length) {
        if (textRef.current) textRef.current.classList.remove("reading-mode");
        clearTimeout(postTimerRef.current);

        // final time flush
        const now = performance.now();
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;
        const bIdx = Number(bookIndex);
        const cIdx = chapterIndexRef.current;
        if (anonId && Number.isInteger(bIdx) && Number.isInteger(cIdx)) {
          fetch("/api/readingprogress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookIndex: bIdx,
              chapterIndex: cIdx,
              sentenceIndex: sentenceIndexRef.current,
              deltaTimeMs: Math.max(0, Math.round(dt)),
              chapterCompleted: true, // 👈 mark this chapter complete
            }),
          }).catch(() => { });
        }

        if (
          autoAdvance &&
          currentBookRef.current &&
          chapterIndexRef.current < currentBookRef.current.chapters.length - 1
        ) {
          chapterIndexRef.current++;
          displayChapter(currentBookRef.current, chapterIndexRef.current).then(() => {
            sentenceIndexRef.current = 0;
            speakSentencesFrom(0);
          });
        } else {
          hardCancelSpeechQueue();
          readingRef.current = false;
        }
        return;
      }

      setHighlight(sentenceIndexRef.current);

      const u = new SpeechSynthesisUtterance(spansNow[sentenceIndexRef.current].innerText);
      const voiceObj = resolveSelectedVoice();
      if (voiceObj) u.voice = voiceObj;
      u.rate = rate || 1;
      u.pitch = pitch || 1;
      u.volume = volume ?? 1;

      u.onstart = () => {
        if (sessionIdRef.current !== mySession) return;
        lastTickRef.current = performance.now();
        // persist current sentence index (delta 0)
        if (anonId && Number.isInteger(bIdx) && Number.isInteger(chapterIndexRef.current)) {
          fetch("/api/readingprogress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookIndex: bIdx,
              chapterIndex: chapterIndexRef.current,
              sentenceIndex: sentenceIndexRef.current,
              deltaTimeMs: 0,
            }),
          }).catch(() => { });
        }
        scheduleHeartbeat();
        livePing("reading");
      };

      u.onend = () => {
        if (sessionIdRef.current !== mySession) return;
        const now = performance.now();
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;
        flushDelta(dt);
        utteranceRef.current = null;
        sentenceIndexRef.current++;
        setTimeout(speakNext, 20);
      };

      u.onerror = () => {
        // Keep UI responsive on speech engine errors
        hardCancelSpeechQueue();
        readingRef.current = false;
      };

      utteranceRef.current = u;
      speechSynthesis.cancel(); // ensure queue is empty before speaking
      speechSynthesis.speak(u);
    };

    if (textRef.current) textRef.current.classList.add("reading-mode");
    speakNext();
  }

  /* ---------- upload picker ---------- */
  function loadUploadById(id) {
    stopReading();
    fetch(`/api/uploads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setUploadData(data);
        currentBookRef.current = null;
        if (chapterTitleRef.current) chapterTitleRef.current.innerText = "Uploaded Text";
        if (bookTitleRef.current) bookTitleRef.current.innerText = data.title;
        if (textRef.current) {
          textRef.current.innerText = data.content || "";
          wrapSentences(textRef.current);
          if (fontSizeRef.current) {
            textRef.current.style.fontSize = fontSizeRef.current.value + "px";
          }
        }
      });
  }

  /* ---------- render ---------- */
  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title} ref={bookTitleRef}>Book Title</h1>
        <button className={styles.closeBtn} onClick={() => { stopReading(); window.location.href = "/library"; }}>✖</button>
      </div>
      <h2 className={styles.chapter} ref={chapterTitleRef}>Chapter Title</h2>


      {showHint && (
        <div className={styles.hintBar} role="note">
          <span>
            💡 Tip: Double-click any text (or press <kbd>N</kbd>) to add a note. Right-click a word or press <kbd>Alt</kbd>+<kbd>D</kbd> to look it up. Press <kbd>B</kbd> to bookmark.
          </span>
          <button className={styles.hintClose} onClick={() => setShowHint(false)} aria-label="Dismiss">Got it</button>
        </div>
      )}

      {/* Resume prompt (only when a server bookmark exists and we haven't acted yet) */}
      {resumePromptOpen && serverBookmark && Number.isInteger(serverBookmark.sentenceIndex) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: "8px 0 0",
            padding: "8px 10px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f9fafb",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span>Resume where you left off? (Sentence {serverBookmark.sentenceIndex + 1})</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                const idx = serverBookmark.sentenceIndex;
                sentenceIndexRef.current = idx;
                setHighlight(idx);
                const spans = Array.from(textRef.current?.querySelectorAll(`.${styles.sentence}`) || []);
                if (spans[idx]) spans[idx].scrollIntoView({ behavior: "smooth", block: "center" });
                setResumePromptOpen(false);
              }}
              title="Jump to saved sentence"
            >
              ↩ Resume
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => setResumePromptOpen(false)}
              title="Stay at chapter start"
            >
              Start at top
            </button>
          </div>
        </div>
      )}

      <div className={styles.sideGrid}>
        <div id="reading-text" ref={textRef} className={styles.text}>
          The chapter text will appear here after selecting a book from the library.
        </div>

        <div>
          <NotesSidePanel
            key={(uploadId ? `u-${uploadId}` : `b-${bookIndex}-c-${chapterIdx}`)}
            uploadId={uploadId ? Number(uploadId) : null}
            bookIndex={!uploadId && Number.isInteger(Number(bookIndex)) ? Number(bookIndex) : null}
            chapterIndex={!uploadId ? chapterIdx : null}
            onJump={(idx) => {
              const spans = Array.from(textRef.current?.querySelectorAll(`.${styles.sentence}`) || []);
              if (!spans.length) return;
              const clamped = Math.max(0, Math.min(idx, spans.length - 1));
              sentenceIndexRef.current = clamped;
              setHighlight(clamped);
              spans[clamped]?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            onChanged={(arr) => {
              try {
                const map = {};
                for (const n of (arr || [])) {
                  if (Number.isInteger(n?.sentenceIndex) && n?.color) {
                    map[n.sentenceIndex] = n.color;
                  }
                }
                noteMapRef.current = map;
                clearNoteDecorations();
                applyNoteDecorations(noteMapRef.current);
              } catch { }
            }}
          />
          <VocabPanel className={styles.vocabPanel} vocab={vocab} onAdd={() => addToVocab(vocab.word)} />
        </div>
      </div>

      {!!ctx && (
        <div className={styles.ctxMenu} style={{ left: ctx.x, top: ctx.y }}>
          <div className={styles.ctxItem} onClick={() => { doDefine(ctx.selection); setCtx(null); }}>Define “{ctx.selection.slice(0, 24)}”</div>
          <div className={styles.ctxItem} onClick={() => { doTranslate(ctx.selection); setCtx(null); }}>Translate</div>
          <div className={styles.ctxItem} onClick={() => { addToVocab(ctx.selection); setCtx(null); }}>Add to vocabulary</div>
          <div className={styles.ctxItem} onClick={() => { setShowPronounce(true); setCtx(null); }}>Pronounce…</div>
        </div>
      )}

      {/* Selection lookup bubble & definition card */}
      <LookupBubble targetId="reading-text" />

      <div className={styles.controlsRow}>
        <button className={styles.primaryBtn} onClick={startReading}>▶ Start</button>
        <button className={styles.secondaryBtn} onClick={pauseReading}>⏸ Pause</button>
        <button className={styles.secondaryBtn} onClick={resumeReading}>🔁 Resume</button>
        <button className={styles.secondaryBtn} onClick={() => { stopReading(); sentenceIndexRef.current = 0; setHighlight(0); }}>🔄 Restart</button>
        <button className={styles.secondaryBtn} onClick={() => {
          const spans = currentSpans();
          const idx = Math.min(sentenceIndexRef.current || 0, Math.max(spans.length - 1, 0));
          const anchorText = spans[idx]?.innerText?.trim().slice(0, 160) || "";
          openNoteAt(idx, anchorText);
        }}>📝 Add note (N)</button>
      </div>

      <details>
        <summary>🔖 Bookmarks & Tools</summary>
        <div className={styles.controlsRow} style={{ marginTop: 8 }}>
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              const scrollY = textRef.current?.scrollTop || 0;
              saveBookmark({
                type: uploadId ? "upload" : "book",
                id: uploadId || bookIndex,
                chapterIndex: uploadId ? undefined : chapterIndexRef.current,
                scrollY,
              });
              // Also persist server-side bookmark for books
              saveServerBookmark();
            }}
          >
            🔖 Save
          </button>
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
            <div><strong>What this does:</strong> Saves your exact sentence in this chapter.</div>
            <div>Next time, you’ll see a “Resume?” prompt or use the buttons below.</div>
          </div>
          {bookmark && (
            <>
              <button className={styles.secondaryBtn} onClick={() => {
                textRef.current?.scrollTo(0, bookmark.scrollY);
              }}>
                ↩ Resume
              </button>
              <button className={styles.secondaryBtn} onClick={() => {
                clearBookmark(uploadId ? "upload" : "book", uploadId || bookIndex);
                setBookmark(null);
              }}>
                🗑 Clear
              </button>
              <span style={{ fontSize: 12, color: "#666" }}>
                Saved at: {new Date(bookmark.timestamp).toLocaleString()}
              </span>
            </>
          )}
        </div>
        {/* If we have a server bookmark, offer a resume button explicitly */}
        {serverBookmark && Number.isInteger(serverBookmark.sentenceIndex) && (
          <div className={styles.controlsRow} style={{ marginTop: 8 }}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                const idx = serverBookmark.sentenceIndex;
                sentenceIndexRef.current = idx;
                setHighlight(idx);
                const spans = Array.from(textRef.current?.querySelectorAll(`.${styles.sentence}`) || []);
                if (spans[idx]) spans[idx].scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              title={`Jump to sentence ${serverBookmark.sentenceIndex + 1}`}
            >
              ↩ Resume to sentence {serverBookmark.sentenceIndex + 1}
            </button>
          </div>
        )}

        {/* Existing local (scroll) bookmark controls */}
        <div className={styles.controlsRow} style={{ marginTop: 8 }}>
          {bookmark && (
            <>
              <button className={styles.secondaryBtn} onClick={() => {
                textRef.current?.scrollTo(0, bookmark.scrollY);
              }}>
                ↩ Resume (scroll position)
              </button>
              <button className={styles.secondaryBtn} onClick={() => {
                clearBookmark(uploadId ? "upload" : "book", uploadId || bookIndex);
                setBookmark(null);
              }}>
                🗑 Clear local
              </button>
              <span style={{ fontSize: 12, color: "#666" }}>
                Saved at: {new Date(bookmark.timestamp).toLocaleString()}
              </span>
            </>
          )}
          {!bookmark && (
            <span style={{ fontSize: 12, color: "#666" }}>
              (No local scroll bookmark yet.)
            </span>
          )}
        </div>
      </details>

      <div className={styles.settingsGrid}>
        <div>
          <label htmlFor="fontSize">Font Size</label>
          <input ref={fontSizeRef} type="range" id="fontSize" min="10" max="40" defaultValue="18" />
        </div>

        <div>
          <label htmlFor="voiceSelect">Voice</label>
          <select
            id="voiceSelect"
            value={selectedVoice?.name || ""}
            onChange={(e) => setSelectedVoice(voices.find((v) => v.name === e.target.value))}
            style={{ width: "100%" }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rate">Rate: {rate.toFixed(2)}</label>
          <input id="rate" type="range" min="0.5" max="2" step="0.05" value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))} />
        </div>

        <div>
          <label htmlFor="pitch">Pitch: {pitch.toFixed(2)}</label>
          <input id="pitch" type="range" min="0" max="2" step="0.05" value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))} />
        </div>

        <div>
          <label htmlFor="volume">Volume: {volume.toFixed(2)}</label>
          <input id="volume" type="range" min="0" max="1" step="0.05" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="autoAdvance" type="checkbox" checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)} />
          <label htmlFor="autoAdvance">Auto‑advance to next chapter</label>
        </div>

        <div>
          <label>Highlight Color</label>
          <div className={styles.colorRow}>
            {["red", "blue", "green", "yellow", "orange"].map(c => (
              <div
                key={c}
                className={styles.swatch}
                style={{ backgroundColor: c }}
                role="button"
                aria-label={`Set highlight color ${c}`}
                onClick={(e) => {
                  const color = window.getComputedStyle(e.currentTarget).backgroundColor || c;
                  highlightedColorRef.current = color;
                  try { localStorage.setItem(hlColorKey, color); } catch { }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.navRow}>
        <button ref={prevChapterRef} className={styles.secondaryBtn}>⬅ Previous Chapter</button>
        <button ref={nextChapterRef} className={styles.secondaryBtn}>Next Chapter ➡</button>
      </div>


      <NotesModal
        open={noteOpen}
        seed={noteSeed}
        onClose={() => setNoteOpen(false)}
        onSave={saveNote}
      />
    </div>
  );
}
