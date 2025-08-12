"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import books from "../../src/content/book-content.js";

export default function ReadingPalClient() {
  const { data: session } = useSession();
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

  // ---------- Helpers ----------
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

  function highlightSentence(idx, color) {
    const container = textRef.current;
    if (!container) return;
    container.querySelectorAll("span.sentence").forEach((el) => {
      el.style.backgroundColor = "";
    });
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

      // Sync highlight exactly when speech starts
      utt.onstart = () => {
        setSentenceIndex(i);
        highlightSentence(i, highlightedColor);
      };

      utt.onend = () => {
        i += 1;
        speak();
      };

      utt.onerror = () => {
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
    // clear any highlight
    const container = textRef.current;
    if (container) {
      container.querySelectorAll("span.sentence").forEach((el) => (el.style.backgroundColor = ""));
    }
  }

  // ---------- Chapter rendering ----------
  const sentencesRef = useRef([]);

  async function displayChapter(book, chapterIndex) {
    // stop any current TTS + clear highlight before rendering a new chapter
    stopReading();

    const chapter = book.chapters[chapterIndex];

    if (chapterTitleRef.current) {
      chapterTitleRef.current.innerText = chapter.chapterTitle;
    }

    if (textRef.current) {
      const container = textRef.current;
      container.innerHTML = "";

      // Split the chapter into sentences and render clickable spans
      const sentences = splitIntoSentences(chapter.content);
      sentencesRef.current = sentences;
      setSentenceIndex(0); // reset to the beginning for the new chapter

      sentences.forEach((s, idx) => {
        const span = document.createElement("span");
        span.className = "sentence";
        span.dataset.si = String(idx);
        span.style.cursor = "pointer";
        span.textContent = s + " ";

        // Click-to-jump: start reading exactly at this sentence
        span.addEventListener("click", () => {
          stopReading();
          startReadingAt(idx); // sentenceIndex is set in utt.onstart
        });

        container.appendChild(span);
      });
    }

    // Log reading progress (server is idempotent)
    if (session?.user?.id) {
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
  // Reset indices when switching books
  useEffect(() => {
    setCurrentChapterIndex(0);
    setSentenceIndex(0);
  }, [bookIndex]);

  // Load book + chapter
  useEffect(() => {
    if (!bookIndex) return;
    const b = books[parseInt(bookIndex)];
    currentBookRef.current = b;
    if (bookTitleRef.current) {
      bookTitleRef.current.innerText = `${b.title} by ${b.author}`;
    }
    displayChapter(b, currentChapterIndex);
    // cleanup between chapter changes
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
