"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import books from "../../src/content/book-content.js";

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

function getBookmark(type, id) {
  const key = `bookmark-${type}-${id}`;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function clearBookmark(type, id) {
  const key = `bookmark-${type}-${id}`;
  localStorage.removeItem(key);
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
  const [lastSentence, setLastSentence] = useState("");


  const currentBookRef = useRef(null);
  const chapterIndexRef = useRef(0);
  const readingRef = useRef(false);
  const paragraphIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);
  const utteranceRef = useRef(null);

  let highlightedColor = "yellow";
  let scrollTimeout;

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

  function throttledScrollSave(key, container) {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (container) {
        localStorage.setItem(key, container.scrollTop);
      }
    }, 200);
  }


  function getAnonId() {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("learnloomId="));
    return match?.split("=")[1];
  }

  useEffect(() => {
    setLastSentence("");
    function loadVoices() {
      const loadedVoices = speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        setVoices(loadedVoices);
        setSelectedVoice(
          loadedVoices.find((v) => v.lang.startsWith("en") && v.name.includes("Female")) || loadedVoices[0]
        );
      }
    }
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

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

            const key = `scroll_book_${bookIndex}_${chapterIndex}`;
            const handler = () => throttledScrollSave(key, textRef.current);

            textRef.current.addEventListener("scroll", handler);

            setTimeout(() => {
              const saved = localStorage.getItem(key);
              if (saved && textRef.current) {
                textRef.current.scrollTop = parseInt(saved);
                showScrollResumeToast();
              }
            }, 100);

            return () => textRef.current?.removeEventListener("scroll", handler);
          }

          // ✅ MOVE BOOKMARK LOGIC INSIDE fetch().then() — after upload loads
          const type = "upload";
          const id = uploadId;
          const found = getBookmark(type, id);
          if (found) {
            setBookmark(found);
            setShowBookmarkButton(true);
          }
        });
    } else if (bookIndex !== null && bookTitleRef.current) {
      currentBookRef.current = books[parseInt(bookIndex)];
      bookTitleRef.current.innerText = `${currentBookRef.current.title} by ${currentBookRef.current.author}`;
      displayChapter(currentBookRef.current, chapterIndexRef.current);

      // ✅ BOOKMARK LOGIC FOR BOOKS
      const type = "book";
      const id = bookIndex;
      const found = getBookmark(type, id);
      if (found) {
        setBookmark(found);
        setShowBookmarkButton(true);
      }
    }

    fetch("/api/uploadedtext")
      .then((res) => res.json())
      .then((data) => setUploads(data));

    if (fontSizeRef.current) {
      fontSizeRef.current.addEventListener("input", function () {
        const newSize = this.value + "px";
        if (textRef.current) textRef.current.style.fontSize = newSize;
      });
    }

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
        if (currentBookRef.current && chapterIndexRef.current < currentBookRef.current.chapters.length - 1) {
          stopReading();
          chapterIndexRef.current++;
          displayChapter(currentBookRef.current, chapterIndexRef.current);
        }
      });
    }

    document.querySelectorAll(".highlight-color .color").forEach((el) => {
      el.addEventListener("click", function () {
        const color = window.getComputedStyle(this).backgroundColor;
        highlightedColor = color;
      });
    });
  }, [bookIndex, uploadId]);

  async function displayChapter(book, chapterIndex) {
    const chapter = book.chapters[chapterIndex];
    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) {
      textRef.current.innerText = chapter.content;

      const key = `scroll_book_${bookIndex}_${chapterIndex}`;
      const handler = () => throttledScrollSave(key, textRef.current);

      textRef.current.addEventListener("scroll", handler);

      setTimeout(() => {
        const saved = localStorage.getItem(key);
        if (saved && textRef.current) {
          textRef.current.scrollTop = parseInt(saved);
          showScrollResumeToast();
        }
      }, 100);

      return () => textRef.current?.removeEventListener("scroll", handler);
    }

    const anonId = getAnonId();
    if (anonId) {
      await fetch("/api/readingprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIndex: parseInt(bookIndex), chapterIndex }),
      });
    }
  }

  // ... rest unchanged


  function loadUploadById(id) {
    stopReading();
    fetch(`/api/uploads/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setUploadData(data);
        currentBookRef.current = null;
        chapterTitleRef.current.innerText = "Uploaded Text";
        bookTitleRef.current.innerText = data.title;
        textRef.current.innerText = data.content;
      });
  }

  function readText() {
    speechSynthesis.cancel();
    const text = uploadData?.content || currentBookRef.current?.chapters?.[chapterIndexRef.current]?.content;
    if (!text) return;
    let paragraphs = text.split(/\n\s*\n|\n/);
    if (paragraphs.length === 1) paragraphs = text.match(/(.{1,500})(\s|$)/g);
    paragraphIndexRef.current = 0;
    readingRef.current = true;

    function speakNext() {
      if (!readingRef.current || paragraphIndexRef.current >= paragraphs.length) {
        return;
      }

      const text = paragraphs[paragraphIndexRef.current];
      console.log("Speaking paragraph index:", paragraphIndexRef.current);
      console.log("Text:", paragraphs[paragraphIndexRef.current]);
      const sentences = text
        .replace(/([^.])\.(\s|$)/g, "$1¶$2") // mark sentence endings
        .replace(/(Mr|Mrs|Dr|Ms|St|Jr|Sr|vs|etc)\s?¶/g, "$1.") // undo false breaks
        .split("¶")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const last = sentences?.[sentences.length - 1]?.trim();
      if (last) setLastSentence(last);
      const words = text.split(/\s+/);
      let wordIndex = 0;
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onboundary = (event) => {
        if (event.name === "word" && wordIndex < words.length) {
          highlightWord(wordIndex, words);
          wordIndex++;
        }
      };

      utterance.onend = () => {
        utteranceRef.current = null;

        paragraphIndexRef.current++;
        if (paragraphIndexRef.current < paragraphs.length) {
          setTimeout(speakNext, 50);
        } else {
          if (!isPausedRef.current && currentBookRef.current) {
            const next = chapterIndexRef.current + 1;
            const hasNext = currentBookRef.current.chapters[next];
            if (hasNext) {
              chapterIndexRef.current = next;
              displayChapter(currentBookRef.current, next);
              setTimeout(() => readText(), 500);
            }
          }
        }
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    }

    speakNext();
  }

  function highlightWord(index, words) {
    const container = textRef.current;
    if (!container) return;

    container.innerHTML = "";
    const key = uploadId
      ? `scroll_upload_${uploadId}`
      : `scroll_book_${bookIndex}_${chapterIndexRef.current}`;

    setTimeout(() => {
      const saved = localStorage.getItem(key);
      if (saved && container) {
        container.scrollTop = parseInt(saved);
      }
    }, 100);

    const before = words.slice(0, index).join(" ") + " ";
    const current = words[index];
    const after = " " + words.slice(index + 1).join(" ");

    container.appendChild(document.createTextNode(before));
    const span = document.createElement("span");
    span.textContent = current;
    span.style.backgroundColor = highlightedColor;
    container.appendChild(span);
    container.appendChild(document.createTextNode(after));
  }

  function startReading() {
    isPausedRef.current = false;
    setLastSentence(""); // 🧽 clear the replay buffer
    readText();
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

  function goBack() {
    stopReading();
    window.location.href = "/library";
  }

  function restartReading() {
    stopReading();
    if (textRef.current) {
      textRef.current.scrollTop = 0;
    }
    readText();
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

      {/* === PRIMARY READING CONTROLS === */}
      <div className="control-row">
        <button onClick={startReading}>▶️ Start</button>
        <button onClick={pauseReading}>⏸ Pause</button>
        <button onClick={resumeReading}>🔁 Resume</button>
        <button onClick={restartReading}>🔄 Restart</button>
      </div>

      {/* === BOOKMARK & REPLAY TOOLS === */}
      <details className="control-tools" style={{ marginTop: "1rem" }}>
        <summary>🔖 Bookmarks & Tools</summary>
        <div className="control-row" style={{ marginTop: "0.5rem" }}>
          <button onClick={() => {
            const scrollY = textRef.current?.scrollTop || 0;
            saveBookmark({
              type: uploadId ? "upload" : "book",
              id: uploadId || bookIndex,
              chapterIndex: uploadId ? undefined : chapterIndexRef.current,
              scrollY
            });
            alert("🔖 Bookmark saved!");
          }}>🔖 Save</button>

          {bookmark && (
            <>
              <button onClick={() => {
                textRef.current?.scrollTo(0, bookmark.scrollY);
                showScrollResumeToast();
              }}>↩ Resume</button>

              <button onClick={() => {
                clearBookmark(uploadId ? "upload" : "book", uploadId || bookIndex);
                setBookmark(null);
                setShowBookmarkButton(false);
              }}>🗑 Clear</button>

              <p style={{ fontSize: "12px", color: "#666" }}>
                Saved at: {new Date(bookmark.timestamp).toLocaleString()}
              </p>
            </>
          )}

          <button onClick={() => {
            if (!lastSentence) return;
            stopReading();
            const utterance = new SpeechSynthesisUtterance(lastSentence);
            if (selectedVoice) utterance.voice = selectedVoice;
            speechSynthesis.speak(utterance);
          }}>🔁 Replay</button>
        </div>
      </details>

      {/* === SETTINGS PANEL === */}
      <div className="settings-section">
        <div>
          <label htmlFor="fontSize">Font Size</label>
          <input ref={fontSizeRef} type="range" id="fontSize" min="10" max="40" />
        </div>

        <div>
          <label htmlFor="voiceSelect">Voice</label>
          <select
            id="voiceSelect"
            value={selectedVoice?.name || ""}
            onChange={(e) => {
              const voice = voices.find(v => v.name === e.target.value);
              setSelectedVoice(voice);
            }}>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="uploadPicker" style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>
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
            <option value="" disabled>Select an upload</option>
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>{u.title}</option>
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
        <button ref={prevChapterRef} className="chapter-btn">⬅ Previous Chapter</button>
        <button ref={nextChapterRef} className="chapter-btn">Next Chapter ➡</button>
      </div>
    </div>
  );
}