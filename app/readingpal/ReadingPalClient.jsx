"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import books from "../../src/content/book-content.js";

// -----------------------------------------------------------------------------
// UTILITY: Save a bookmark to localStorage
// -----------------------------------------------------------------------------
function saveBookmark({ type, id, chapterIndex, scrollY }) {
  const key = `bookmark-${type}-${id}`;
  const value = {
    type,
    id,
    chapterIndex,
    scrollY,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(value));
}

// -----------------------------------------------------------------------------
// UTILITY: Retrieve a bookmark from localStorage
// -----------------------------------------------------------------------------
function getBookmark(type, id) {
  const key = `bookmark-${type}-${id}`;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

// -----------------------------------------------------------------------------
// UTILITY: Clear a bookmark from localStorage
// -----------------------------------------------------------------------------
function clearBookmark(type, id) {
  const key = `bookmark-${type}-${id}`;
  localStorage.removeItem(key);
}

// -----------------------------------------------------------------------------
// UTILITY: Throttled scroll-position saving
// -----------------------------------------------------------------------------
function throttledScrollSave(key, container) {
  clearTimeout(throttledScrollSave.timeout);
  throttledScrollSave.timeout = setTimeout(() => {
    if (container) {
      localStorage.setItem(key, container.scrollTop);
    }
  }, 200);
}

// -----------------------------------------------------------------------------
// UTILITY: Apply saved scroll position and show toast
// -----------------------------------------------------------------------------
function applySavedScroll(key, container) {
  const saved = localStorage.getItem(key);
  if (saved && container) {
    container.scrollTop = parseInt(saved, 10);
    showScrollResumeToast();
  }
}

// -----------------------------------------------------------------------------
// UTILITY: Show a brief “resumed” toast
// -----------------------------------------------------------------------------
function showScrollResumeToast() {
  const toast = document.createElement("div");
  toast.textContent = "Resumed from last scroll position";
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = "#333";
  toast.style.color = "white";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "8px";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "14px";
  toast.style.opacity = "0.9";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// -----------------------------------------------------------------------------
// UTILITY: Get anonymous ID from cookie
// -----------------------------------------------------------------------------
function getAnonId() {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("learnloomId="));
  return match?.split("=")[1];
}

export default function ReadingPalClient() {
  const searchParams = useSearchParams();
  const uploadId = searchParams.get("upload");
  const bookIndex = searchParams.get("bookIndex");

  const [uploadData, setUploadData] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [bookmark, setBookmark] = useState(null);
  const [showBookmarkButton, setShowBookmarkButton] = useState(false);

  const currentBookRef = useRef(null);
  const chapterIndexRef = useRef(0);
  const readingRef = useRef(false);
  const sentenceIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);
  const utteranceRef = useRef(null);

  let highlightedColor = "yellow";

  // =============================================================================
  // 1) Load speechSynthesis voices ON MOUNT
  // =============================================================================
  useEffect(() => {
    function loadVoices() {
      const loadedVoices = speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        setVoices(loadedVoices);
        setSelectedVoice(
          loadedVoices.find((v) => v.lang.startsWith("en") && v.name.includes("Female")) ||
            loadedVoices[0]
        );
      }
    }
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // =============================================================================
  // 2) Font‐Slider: Apply font size whenever the slider moves
  // =============================================================================
  useEffect(() => {
    const input = fontSizeRef.current;
    const text = textRef.current;
    function applyFontSize(e) {
      const newSize = e.target.value + "px";
      if (text) text.style.fontSize = newSize;
    }
    if (input) {
      input.addEventListener("input", applyFontSize);
      return () => input.removeEventListener("input", applyFontSize);
    }
  }, [fontSizeRef, textRef]);

  // =============================================================================
  // 3) BOOK / UPLOAD LOADING + Scroll & Bookmark Logic
  // =============================================================================
  useEffect(() => {
    if (uploadId) {
      fetch(`/api/uploads/${uploadId}`)
        .then((res) => res.json())
        .then((data) => {
          setUploadData(data);
          if (bookTitleRef.current) bookTitleRef.current.innerText = data.title;
          if (chapterTitleRef.current) chapterTitleRef.current.innerText = "Uploaded Text";
          if (textRef.current) {
            textRef.current.innerText = data.content;

            // Wrap each sentence in a <span class="sentence" data-index="…">
            wrapSentences(textRef.current);

            // Throttle scroll save
            const key = `scroll_upload_${uploadId}`;
            const handler = () => throttledScrollSave(key, textRef.current);
            textRef.current.addEventListener("scroll", handler);

            // Resume scroll
            setTimeout(() => applySavedScroll(key, textRef.current), 100);

            // Re‐apply font size
            if (fontSizeRef.current && textRef.current) {
              const newSize = fontSizeRef.current.value + "px";
              textRef.current.style.fontSize = newSize;
            }
          }

          // Bookmark (upload)
          const found = getBookmark("upload", uploadId);
          if (found) {
            setBookmark(found);
            setShowBookmarkButton(true);
          }
        });
    } else if (bookIndex !== null && bookTitleRef.current) {
      currentBookRef.current = books[parseInt(bookIndex)];
      bookTitleRef.current.innerText = `${currentBookRef.current.title} by ${currentBookRef.current.author}`;
      displayChapter(currentBookRef.current, chapterIndexRef.current);

      const found = getBookmark("book", bookIndex);
      if (found) {
        setBookmark(found);
        setShowBookmarkButton(true);
      }
    }

    // Fetch all uploads for the dropdown
    fetch("/api/uploadedtext")
      .then((res) => res.json())
      .then((data) => setUploads(data));

    // Prev / Next chapter handlers
    if (prevChapterRef.current) {
      prevChapterRef.current.addEventListener("click", () => {
        if (chapterIndexRef.current > 0 && currentBookRef.current) {
          stopReading();
          chapterIndexRef.current--;
          displayChapter(currentBookRef.current, chapterIndexRef.current);
        }
      });
    }
    if (nextChapterRef.current) {
      nextChapterRef.current.addEventListener("click", () => {
        if (
          currentBookRef.current &&
          chapterIndexRef.current < currentBookRef.current.chapters.length - 1
        ) {
          stopReading();
          chapterIndexRef.current++;
          displayChapter(currentBookRef.current, chapterIndexRef.current);
        }
      });
    }

    // Highlight‐color picker logic (optional)
    document.querySelectorAll(".highlight-color .color").forEach((el) => {
      el.addEventListener("click", function () {
        const color = window.getComputedStyle(this).backgroundColor;
        highlightedColor = color;
      });
    });
  }, [bookIndex, uploadId]);

  // =============================================================================
  // 4) Display a given chapter of a book
  // =============================================================================
  async function displayChapter(book, chapterIndex) {
    stopReading();
    const chapter = book.chapters[chapterIndex];
    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) {
      textRef.current.innerText = chapter.content;

      // Wrap each sentence in a <span class="sentence" data-index="…">
      wrapSentences(textRef.current);

      const key = `scroll_book_${bookIndex}_${chapterIndex}`;
      const handler = () => throttledScrollSave(key, textRef.current);
      textRef.current.addEventListener("scroll", handler);

      setTimeout(() => applySavedScroll(key, textRef.current), 100);

      // Re‐apply font size
      if (fontSizeRef.current && textRef.current) {
        const newSize = fontSizeRef.current.value + "px";
        textRef.current.style.fontSize = newSize;
      }
    }

    // Post reading progress
    const anonId = getAnonId();
    if (anonId) {
      await fetch("/api/readingprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIndex: parseInt(bookIndex), chapterIndex }),
      });
    }
  }

  // =============================================================================
  // 5) Wrap Sentences in <span class="sentence" data-index="…">
  // =============================================================================
  function wrapSentences(container) {
    const plain = container.innerText;
    if (!plain.trim()) return;

    // Split plain text into sentences; this regex captures 
    // “everything up to and including the punctuation (., !, ?)”.
    const sentences = plain.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
    let html = "";

    sentences.forEach((sent, i) => {
      // Trim only leading/trailing spaces—keep the sentence itself intact
      const trimmed = sent.trim();
      if (trimmed.length === 0) return; // skip blank lines, if any
      html += `<span class="sentence" data-index="${i}">${trimmed} </span>`;
    });

    container.innerHTML = html;
  }


  // =============================================================================
  // 6) Click-to-play: highlight clicked sentence + read from there onward
  // =============================================================================
  function handleSentenceClick(e) {
    stopReading();

    const container = textRef.current;
    if (!container) return;

    // 1) Locate which <span class="sentence"> was clicked
    const clickedSpan = e.target.closest(".sentence");
    if (!clickedSpan) return;

    // 2) Build an up-to-date array of all sentence spans
    const sentenceSpans = Array.from(container.querySelectorAll(".sentence"));

    // 3) Compute the index of the clicked span in that array
    const idx = sentenceSpans.indexOf(clickedSpan);
    if (idx === -1) return;

    // 4) Clear any existing highlight, then highlight only the clicked span
    sentenceSpans.forEach((sp) => sp.classList.remove("highlighted-sentence"));
    clickedSpan.classList.add("highlighted-sentence");

    // 5) Smooth-scroll the clicked sentence into view
    clickedSpan.scrollIntoView({ behavior: "smooth", block: "center" });

    // 6) Begin TTS from exactly that sentence onward
    speakSentencesFrom(idx);
  }


  // =============================================================================
  // 7) Speak sentences recursively from a given start index
  // =============================================================================
  function speakSentencesFrom(startIdx) {
    const container = textRef.current;
    if (!container) return;

    const sentenceSpans = Array.from(container.querySelectorAll(".sentence"));
    sentenceIndexRef.current = startIdx;
    readingRef.current = true;

    function speakNext() {
      if (!readingRef.current || sentenceIndexRef.current >= sentenceSpans.length) {
        // Once done, make sure to remove the "reading-mode" class (if you have it)
        if (textRef.current) {
          textRef.current.classList.remove("reading-mode");
        }
        return;
      }

      // Highlight exactly the current sentence
      sentenceSpans.forEach((sp) => sp.classList.remove("highlighted-sentence"));
      const currentSpan = sentenceSpans[sentenceIndexRef.current];
      currentSpan.classList.add("highlighted-sentence");

      const textToSpeak = currentSpan.innerText;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onend = () => {
        utteranceRef.current = null;
        sentenceIndexRef.current++;
        setTimeout(speakNext, 50);
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    }

    // If you are using the “reading-mode” trick to suppress hover-dimming, add it here:
    if (textRef.current) {
      textRef.current.classList.add("reading-mode");
    }

    speakNext();
  }


  // =============================================================================
  // 8) Primary TTS Controls 
  //    - Start = speak from the first sentence of current chapter/upload 
  //    - Pause / Resume / Stop 
  //    - Restart = scroll to top, then speak from sentence 0
  // =============================================================================
  function startReading() {
    isPausedRef.current = false;
    sentenceIndexRef.current = 0;

    // Remove any existing highlights
    textRef.current
      .querySelectorAll(".highlighted-sentence")
      .forEach((sp) => sp.classList.remove("highlighted-sentence"));

    speakSentencesFrom(0);
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
  }

  function restartReading() {
    stopReading();
    if (textRef.current) textRef.current.scrollTop = 0;
    startReading();
  }

  // =============================================================================
  // 9) Click listener: attach to #text for any click on a sentence
  // =============================================================================
  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    container.addEventListener("click", handleSentenceClick);
    return () => {
      container.removeEventListener("click", handleSentenceClick);
    };
  }, [textRef, selectedVoice]);

  // =============================================================================
  // 10) Navigation / Utility
  // =============================================================================
  function goBack() {
    stopReading();
    window.location.href = "/library";
  }

  // =============================================================================
  // 11) Load a selected upload by its ID
  // =============================================================================
  function loadUploadById(id) {
    stopReading();
    fetch(`/api/uploads/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setUploadData(data);
        currentBookRef.current = null;
        if (chapterTitleRef.current) chapterTitleRef.current.innerText = "Uploaded Text";
        if (bookTitleRef.current) bookTitleRef.current.innerText = data.title;
        if (textRef.current) {
          textRef.current.innerText = data.content;

          // Wrap sentences:
          wrapSentences(textRef.current);

          // Re‐apply font size
          if (fontSizeRef.current && textRef.current) {
            const newSize = fontSizeRef.current.value + "px";
            textRef.current.style.fontSize = newSize;
          }
        }
      });
  }

  // =============================================================================
  // 12) RENDER JSX
  // =============================================================================
  return (
    <div className="readingpal-wrapper">
      <h1 className="readingpal-title" ref={bookTitleRef}>
        Book Title
      </h1>
      <div>
        <button className="close-btn" onClick={goBack}>
          &#x2716;
        </button>
        <h2 className="readingpal-chapter" ref={chapterTitleRef}>
          Chapter Title
        </h2>
        <div
          id="text"
          ref={textRef}
          style={{
            cursor: "text",
            whiteSpace: "normal",
            background: "#f8f8f8",
            padding: "20px",
            borderRadius: "8px",
            maxHeight: "400px",
            overflowY: "auto",
            fontSize: "16px",
            lineHeight: "1.6",
            color: "#333",
            marginBottom: "30px",
            transition: "background-color 0.2s ease",
          }}
        >
          {/* This will be replaced by displayChapter or upload fetch */}
          The chapter text will appear here after selecting a book from the library.
        </div>
      </div>

      {/* === PRIMARY READING CONTROLS === */}
      <div className="control-row">
        <button onClick={startReading}>▶️ Start</button>
        <button onClick={pauseReading}>⏸ Pause</button>
        <button onClick={resumeReading}>🔁 Resume</button>
        <button onClick={restartReading}>🔄 Restart</button>
      </div>

      {/* === BOOKMARKS & TOOLS === */}
      <details className="control-tools" style={{ marginTop: "1rem" }}>
        <summary>🔖 Bookmarks & Tools</summary>
        <div className="control-row" style={{ marginTop: "0.5rem" }}>
          <button
            onClick={() => {
              const scrollY = textRef.current?.scrollTop || 0;
              saveBookmark({
                type: uploadId ? "upload" : "book",
                id: uploadId || bookIndex,
                chapterIndex: uploadId ? undefined : chapterIndexRef.current,
                scrollY,
              });
              alert("🔖 Bookmark saved!");
            }}
          >
            🔖 Save
          </button>

          {bookmark && (
            <>
              <button
                onClick={() => {
                  textRef.current?.scrollTo(0, bookmark.scrollY);
                  showScrollResumeToast();
                }}
              >
                ↩ Resume
              </button>

              <button
                onClick={() => {
                  clearBookmark(
                    uploadId ? "upload" : "book",
                    uploadId || bookIndex
                  );
                  setBookmark(null);
                  setShowBookmarkButton(false);
                }}
              >
                🗑 Clear
              </button>

              <p style={{ fontSize: "12px", color: "#666" }}>
                Saved at: {new Date(bookmark.timestamp).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </details>

      {/* === SETTINGS PANEL === */}
      <div className="settings-section">
        <div>
          <label htmlFor="fontSize">Font Size</label>
          <input
            ref={fontSizeRef}
            type="range"
            id="fontSize"
            min="10"
            max="40"
            defaultValue="18"
          />
        </div>

        <div>
          <label htmlFor="voiceSelect">Voice</label>
          <select
            id="voiceSelect"
            value={selectedVoice?.name || ""}
            onChange={(e) => {
              const voice = voices.find((v) => v.name === e.target.value);
              setSelectedVoice(voice);
            }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="uploadPicker"
            style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}
          >
            📤 Uploaded Texts
          </label>
          <select
            id="uploadPicker"
            onChange={(e) => loadUploadById(e.target.value)}
            defaultValue=""
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "14px",
              width: "100%",
              maxWidth: "250px",
            }}
          >
            <option value="" disabled>
              Select an upload
            </option>
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Highlight Color</label>
          <div className="highlight-color">
            <div className="color" style={{ backgroundColor: "red" }}></div>
            <div className="color" style={{ backgroundColor: "blue" }}></div>
            <div className="color" style={{ backgroundColor: "green" }}></div>
            <div className="color" style={{ backgroundColor: "yellow" }}></div>
            <div className="color" style={{ backgroundColor: "orange" }}></div>
          </div>
        </div>
      </div>

      {/* === CHAPTER NAVIGATION === */}
      <div className="control-row" style={{ marginTop: "2rem" }}>
        <button ref={prevChapterRef} className="chapter-btn">
          ⬅ Previous Chapter
        </button>
        <button ref={nextChapterRef} className="chapter-btn">
          Next Chapter ➡
        </button>
      </div>
    </div>
  );
}
// =============================================================================