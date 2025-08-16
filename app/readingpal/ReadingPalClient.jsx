"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import books from "../../src/content/book-content.js";
import styles from "./readingpal.module.css";

/* ------- helpers ------- */
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

  const currentBookRef = useRef(null);
  const chapterIndexRef = useRef(0);

  const textRef = useRef(null);
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);

  const readingRef = useRef(false);
  const sentenceIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const utteranceRef = useRef(null);

  const sessionIdRef = useRef(0);
  const lastTickRef = useRef(0);
  const postTimerRef = useRef(null);

  let highlightedColor = "yellow";

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
    function loadVoices() {
      const v = speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        setSelectedVoice(
          v.find((vv) => vv.lang?.startsWith("en") && vv.name?.includes("Female")) || v[0]
        );
      }
    }
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    const p = loadPrefs(anonId);
    if (p) {
      if (typeof p.rate === "number") setRate(p.rate);
      if (typeof p.pitch === "number") setPitch(p.pitch);
      if (typeof p.volume === "number") setVolume(p.volume);
      if (typeof p.autoAdvance === "boolean") setAutoAdvance(p.autoAdvance);
    }
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
    if (!p?.voiceName || !voices.length) return;
    const found = voices.find((v) => v.name === p.voiceName);
    if (found) setSelectedVoice(found);
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
          const h = () => throttledScrollSave(key, textRef.current);
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

    // color palette
    document.querySelectorAll(`.${styles.swatch}`).forEach((el) => {
      el.addEventListener("click", function () {
        highlightedColor = window.getComputedStyle(this).backgroundColor;
      });
    });

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

    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) {
      textRef.current.innerText = chapter.content || "";
      wrapSentences(textRef.current);

      const key = `scroll_book_${bookIndex}_${chapterIndex}`;
      const h = () => throttledScrollSave(key, textRef.current);
      textRef.current.addEventListener("scroll", h);
      setTimeout(() => applySavedScroll(key, textRef.current), 80);
      if (fontSizeRef.current) {
        textRef.current.style.fontSize = fontSizeRef.current.value + "px";
      }
    }

    // Check if a server bookmark exists for this chapter.
    // If resume=1 is present, jump automatically; otherwise show the prompt.
    await loadServerBookmark(resumeFlag);
  }

  /* ---------- sentence wrapping & highlight ---------- */
  function wrapSentences(container) {
    const sentences = (container.innerText || "")
      .match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
    container.innerHTML = sentences
      .map((s, i) => `<span class="${styles.sentence}" data-index="${i}">${s.trim()} </span>`)
      .join("");
  }

  function currentSpans() {
    return Array.from(textRef.current?.querySelectorAll(`.${styles.sentence}`) || []);
  }

  function setHighlight(idx) {
    const spans = currentSpans();
    spans.forEach((sp) => {
      sp.classList.remove(styles.highlightedSentence);
      sp.style.backgroundColor = "";
    });
    const t = spans[idx];
    if (t) {
      t.classList.add(styles.highlightedSentence);
      t.style.backgroundColor = highlightedColor; // keep your color palette override
      t.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }


  /* ---------- click‑to‑play ---------- */
  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    const handler = (e) => {
      const span = e.target.closest(`.${styles.sentence}`);
      if (!span) return;
      const idx = Number(span.getAttribute("data-index"));
      if (!Number.isInteger(idx)) return;
      stopReading(); // cancel any queued speech
      setHighlight(idx);
      speakSentencesFrom(idx);
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [selectedVoice, rate, pitch, volume]);

  /* ---------- jump helper ---------- */
  function jumpToSentence(idx, start = false) {
    const spans = currentSpans();
    if (!spans.length) return;
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
      if (selectedVoice) u.voice = selectedVoice;
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

      <div id="text" ref={textRef} className={styles.text}>
        The chapter text will appear here after selecting a book from the library.
      </div>

      <div className={styles.controlsRow}>
        <button className={styles.primaryBtn} onClick={startReading}>▶ Start</button>
        <button className={styles.secondaryBtn} onClick={pauseReading}>⏸ Pause</button>
        <button className={styles.secondaryBtn} onClick={resumeReading}>🔁 Resume</button>
        <button className={styles.secondaryBtn} onClick={() => { stopReading(); sentenceIndexRef.current = 0; setHighlight(0); }}>🔄 Restart</button>
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
            <div className={styles.swatch} style={{ backgroundColor: "red" }} />
            <div className={styles.swatch} style={{ backgroundColor: "blue" }} />
            <div className={styles.swatch} style={{ backgroundColor: "green" }} />
            <div className={styles.swatch} style={{ backgroundColor: "yellow" }} />
            <div className={styles.swatch} style={{ backgroundColor: "orange" }} />
          </div>
        </div>
      </div>

      <div className={styles.navRow}>
        <button ref={prevChapterRef} className={styles.secondaryBtn}>⬅ Previous Chapter</button>
        <button ref={nextChapterRef} className={styles.secondaryBtn}>Next Chapter ➡</button>
      </div>
    </div>
  );
}
