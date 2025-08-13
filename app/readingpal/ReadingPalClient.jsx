"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import books from "../../src/content/book-content.js";

export default function ReadingPalClient() {
  const searchParams = useSearchParams();
  const bookIndex = searchParams.get("bookIndex");

  // Refs & state
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);

  const utteranceRef = useRef(null);
  const readingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentBookRef = useRef(null);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [highlightedColor, setHighlightedColor] = useState("yellow");

  // sentence+word helpers
  const sentencesRef = useRef([]);
  const lastSentenceElRef = useRef(null);
  const currentWordRef = useRef(0);
  const wordOffsetsRef = useRef([]);

  function goBack() {
    stopReading();
    window.location.href = "/library";
  }

  function splitIntoSentences(text) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    const parts = cleaned.match(/[^.!?]+[.!?]*/g);
    return parts && parts.length ? parts : [cleaned];
  }

  function getSentenceSpan(idx) {
    return textRef.current?.querySelector(`span.sentence[data-si="${idx}"]`);
  }

  function clearActiveWord() {
    const root = textRef.current;
    if (!root) return;
    root.querySelectorAll("span.w.active-word").forEach((el) => {
      el.classList.remove("active-word");
      el.style.textDecoration = "";
    });
  }

  function highlightSentence(idx, color) {
    const container = textRef.current;
    if (!container) return;
    container.querySelectorAll("span.sentence").forEach((el) => {
      el.style.backgroundColor = "";
    });
    clearActiveWord();
    const el = getSentenceSpan(idx);
    if (el) el.style.backgroundColor = color;
  }

  function handleFontSizeChange(e) {
    const newSize = `${e.target.value}px`;
    if (textRef.current) textRef.current.style.fontSize = newSize;
  }

  function updateHighlightColor(color) {
    setHighlightedColor(color);
  }

  function renderWordSpansForSentence(sentenceIdx) {
    const el = getSentenceSpan(sentenceIdx);
    if (!el) return;

    lastSentenceElRef.current = el;

    const text = sentencesRef.current[sentenceIdx] || "";
    el.innerHTML = ""; // keep outer sentence span, replace its contents

    // Build spans for words and text nodes for spaces
    wordOffsetsRef.current = [];
    const tokens = [...text.matchAll(/\S+|\s+/g)];
    for (const m of tokens) {
      const tok = m[0];
      const isWord = /\S/.test(tok[0]);
      if (isWord) {
        const wi = wordOffsetsRef.current.length;
        wordOffsetsRef.current.push(m.index ?? 0);
        const w = document.createElement("span");
        w.className = "w";
        w.dataset.wi = String(wi);
        w.textContent = tok;
        el.appendChild(w);
      } else {
        el.appendChild(document.createTextNode(tok));
      }
    }
  }

  function setActiveWord(wordIdx) {
    const host = lastSentenceElRef.current;
    if (!host) return;

    const prev = host.querySelector("span.w.active-word");
    if (prev) {
      prev.classList.remove("active-word");
      prev.style.textDecoration = "";
    }

    const cur = host.querySelector(`span.w[data-wi="${wordIdx}"]`);
    if (cur) {
      cur.classList.add("active-word");
      cur.style.textDecoration = "underline";
    }
  }

  // ---------- TTS controls ----------
  function startReadingAt(startIdx) {
    const sents = sentencesRef.current;
    if (!sents || !sents.length) return;

    speechSynthesis.cancel();
    utteranceRef.current = null;
    readingRef.current = true;

    let i = startIdx;

    const speak = () => {
      if (!readingRef.current || i >= sents.length) {
        readingRef.current = false;
        return;
      }

      const utt = new SpeechSynthesisUtterance(sents[i]);
      utteranceRef.current = utt;

      utt.onstart = () => {
        clearActiveWord();
        setSentenceIndex(i);
        highlightSentence(i, highlightedColor);
        renderWordSpansForSentence(i);
        currentWordRef.current = 0;
        setActiveWord(0);
      };

      // advance active word using charIndex → nearest word start
      utt.onboundary = (e) => {
        if (typeof e.charIndex !== "number" || !wordOffsetsRef.current.length) return;
        const ci = e.charIndex;
        const offs = wordOffsetsRef.current;
        // binary search: greatest offset <= charIndex
        let lo = 0, hi = offs.length - 1, ans = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (offs[mid] <= ci) { ans = mid; lo = mid + 1; }
          else { hi = mid - 1; }
        }
        if (ans !== currentWordRef.current) {
          currentWordRef.current = ans;
          setActiveWord(ans);
        }
      };

      utt.onend = () => {
        clearActiveWord();
        i += 1;
        speak();
      };

      utt.onerror = () => {
        clearActiveWord();
        i += 1;
        speak();
      };

      speechSynthesis.speak(utt);
    };

    speak();
  }

  function startReading() {
    startReadingAt(sentenceIndex);
  }

  function pauseReading() {
    if (!isPausedRef.current && speechSynthesis.speaking) {
      speechSynthesis.pause();
      isPausedRef.current = true;
    }
  }

  function resumeReading() {
    if (isPausedRef.current && speechSynthesis.paused) {
      speechSynthesis.resume();
      isPausedRef.current = false;
    }
  }

  function stopReading() {
    readingRef.current = false;
    speechSynthesis.cancel();
    utteranceRef.current = null;
    isPausedRef.current = false;
    const container = textRef.current;
    if (container) {
      container.querySelectorAll("span.sentence").forEach((el) => (el.style.backgroundColor = ""));
      clearActiveWord();
    }
  }

  // ---------- Chapter rendering ----------
  async function displayChapter(book, chapterIndex) {
    stopReading();
    const chapter = book.chapters[chapterIndex];

    if (chapterTitleRef.current) {
      chapterTitleRef.current.innerText = chapter.chapterTitle;
    }

    if (textRef.current) {
      const container = textRef.current;
      container.innerHTML = "";

      const sentences = splitIntoSentences(chapter.content);
      sentencesRef.current = sentences;
      setSentenceIndex(0);

      sentences.forEach((s, idx) => {
        const span = document.createElement("span");
        span.className = "sentence";
        span.dataset.si = String(idx);
        span.style.cursor = "pointer";
        span.textContent = s + " ";

        span.addEventListener("click", () => {
          stopReading();
          startReadingAt(idx); // sentenceIndex set in onstart
        });

        container.appendChild(span);
      });
    }

    // Log reading progress (server handles anonId and idempotency)
    try {
      await fetch("/api/readingprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIndex: parseInt(bookIndex),
          chapterIndex,
        }),
      });
    } catch (e) {
      console.error("Reading progress POST failed:", e);
    }
  }

  function handlePrevChapter() {
    if (!currentBookRef.current) return;
    if (currentChapterIndex > 0) {
      stopReading();
      setSentenceIndex(0);
      setCurrentChapterIndex((i) => i - 1);
    }
  }

  function handleNextChapter() {
    const b = currentBookRef.current;
    if (!b) return;
    if (currentChapterIndex < b.chapters.length - 1) {
      stopReading();
      setSentenceIndex(0);
      setCurrentChapterIndex((i) => i + 1);
    }
  }

  // ---------- Effects ----------
  useEffect(() => {
    setCurrentChapterIndex(0);
    setSentenceIndex(0);
  }, [bookIndex]);

  useEffect(() => {
    if (!bookIndex) return;
    const b = books[parseInt(bookIndex)];
    currentBookRef.current = b;
    if (bookTitleRef.current) {
      bookTitleRef.current.innerText = `${b.title} by ${b.author}`;
    }
    displayChapter(b, currentChapterIndex);
    return () => {
      speechSynthesis.cancel();
      utteranceRef.current = null;
      readingRef.current = false;
      isPausedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookIndex, currentChapterIndex]);

  // ---------- UI ----------
  if (!bookIndex) {
    return (
      <div className="readingpal-wrapper">
        <h1 className="readingpal-title">No Book Selected</h1>
        <img src="/assets/images/empty-book.png" alt="Empty" style={{ maxWidth: "300px", margin: "0 auto" }} />
        <p style={{ textAlign: "center", color: "#666", maxWidth: "600px", margin: "20px auto" }}>
          Please go back to the library and select a book to begin reading with your Reading Pal.
        </p>
        <div className="control-buttons" style={{ justifyContent: "center" }}>
          <button onClick={goBack}>Return to Library</button>
        </div>
      </div>
    );
  }

  return (
    <div className="readingpal-wrapper">
      <h1 className="readingpal-title" ref={bookTitleRef}>Book Title</h1>
      <div>
        <button className="close-btn" onClick={goBack}>&#x2716;</button>
        <h2 className="readingpal-chapter" ref={chapterTitleRef}>Chapter Title</h2>
        <div id="text" ref={textRef}>
          The chapter text will appear here after selecting a book from the library.
        </div>
      </div>

      <div className="control-buttons">
        <button onClick={startReading}>Start Reading</button>
        <button onClick={pauseReading}>Pause</button>
        <button onClick={resumeReading}>Resume</button>
        <button onClick={stopReading}>Stop</button>
      </div>

      <div className="chapter-nav-row">
        <button className="chapter-btn" onClick={handlePrevChapter} disabled={currentChapterIndex === 0}>
          Previous Chapter
        </button>
        <div className="settings-section">
          <label htmlFor="fontSize">Font Size</label>
          <input type="range" id="fontSize" min="10" max="40" defaultValue="16" onChange={handleFontSizeChange} />
          <label>Highlight Color</label>
          <div className="highlight-color">
            <div className="color" style={{ backgroundColor: "red" }} onClick={() => updateHighlightColor("red")}></div>
            <div className="color" style={{ backgroundColor: "blue" }} onClick={() => updateHighlightColor("blue")}></div>
            <div className="color" style={{ backgroundColor: "green" }} onClick={() => updateHighlightColor("green")}></div>
            <div className="color" style={{ backgroundColor: "yellow" }} onClick={() => updateHighlightColor("yellow")}></div>
            <div className="color" style={{ backgroundColor: "orange" }} onClick={() => updateHighlightColor("orange")}></div>
          </div>
        </div>
        <button className="chapter-btn" onClick={handleNextChapter}>
          Next Chapter
        </button>
      </div>
    </div>
  );
}
