"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import books from "../../src/content/book-content.js";
import { useEffect, useRef } from "react";

export default function ReadingPalClient() {
  const { data: session, status } = useSession();
  const readingRef = useRef(false);
  const searchParams = useSearchParams();
  const bookIndex = searchParams.get("bookIndex");

  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);
  const utteranceRef = useRef(null);

  let highlightedColor = "yellow";
  let currentBook = null;
  let currentChapterIndex = 0;
  let isPaused = false;

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

  useEffect(() => {
    if (bookTitleRef.current && bookIndex !== null) {
      currentBook = books[parseInt(bookIndex)];
      bookTitleRef.current.innerText = `${currentBook.title} by ${currentBook.author}`;
      displayChapter(currentBook, currentChapterIndex);
    }

    if (fontSizeRef.current) {
      fontSizeRef.current.addEventListener("input", function () {
        const newSize = this.value + "px";
        if (textRef.current) textRef.current.style.fontSize = newSize;
      });
    }

    if (prevChapterRef.current) {
      prevChapterRef.current.addEventListener("click", () => {
        if (currentChapterIndex > 0) {
          stopReading();
          currentChapterIndex--;
          displayChapter(currentBook, currentChapterIndex);
        }
      });
    }

    if (nextChapterRef.current) {
      nextChapterRef.current.addEventListener("click", () => {
        if (currentChapterIndex < currentBook.chapters.length - 1) {
          stopReading();
          currentChapterIndex++;
          displayChapter(currentBook, currentChapterIndex);
        }
      });
    }

    // Add color picker listeners
    document.querySelectorAll(".highlight-color .color").forEach((colorElement) => {
      colorElement.addEventListener("click", function () {
        const selectedColor = window.getComputedStyle(this).backgroundColor;
        updateHighlightColor(selectedColor);
      });
    });
  }, [bookIndex]);

  async function displayChapter(book, chapterIndex) {
    const chapter = book.chapters[chapterIndex];
    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) textRef.current.innerText = chapter.content;

    if (session?.user?.id) {
      console.log("Posting reading progress:", bookIndex, chapterIndex);
      await fetch("/api/readingprogress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIndex: parseInt(bookIndex),
          chapterIndex,
        }),
      });
    }
  }

  function readText() {
    speechSynthesis.cancel();

    const text = currentBook.chapters[currentChapterIndex].content;
    let paragraphs = text.split(/\n\s*\n|\n/);
    if (paragraphs.length === 1) {
      paragraphs = text.match(/(.{1,500})(\s|$)/g);
    }

    let paragraphIndex = 0;

    readingRef.current = true;

    function speakNextParagraph() {
      if (!readingRef.current) return;

      if (paragraphIndex < paragraphs.length) {
        const paragraphText = paragraphs[paragraphIndex];
        const words = paragraphText.split(/\s+/);
        let wordIndex = 0;

        utteranceRef.current = new SpeechSynthesisUtterance(paragraphText);
        const utterance = utteranceRef.current;

        utterance.onboundary = (event) => {
          if (event.name === "word" && wordIndex < words.length) {
            highlightWord(wordIndex, words);
            wordIndex++;
          }
        };

        utterance.onend = () => {
          utteranceRef.current = null;
          if (readingRef.current) {
            paragraphIndex++;
            setTimeout(speakNextParagraph, 50);
          }
        };

        speechSynthesis.speak(utterance);
      }
    }

    speakNextParagraph();
  }

  function updateHighlightColor(color) {
    highlightedColor = color;
  }

  function highlightWord(wordIndex, words) {
    const paragraphElement = textRef.current;
    if (!paragraphElement) return;

    paragraphElement.innerHTML = "";

    const beforeWord = words.slice(0, wordIndex).join(" ") + " ";
    const currentWord = words[wordIndex];
    const afterWord = " " + words.slice(wordIndex + 1).join(" ");

    const beforeSpan = document.createTextNode(beforeWord);
    const highlightSpan = document.createElement("span");
    highlightSpan.textContent = currentWord;
    highlightSpan.style.backgroundColor = highlightedColor;
    const afterSpan = document.createTextNode(afterWord);

    paragraphElement.appendChild(beforeSpan);
    paragraphElement.appendChild(highlightSpan);
    paragraphElement.appendChild(afterSpan);
  }

  function startReading() {
    if (currentBook) readText();
  }

  function pauseReading() {
    if (!isPaused && speechSynthesis.speaking) {
      speechSynthesis.pause();
      isPaused = true;
    }
  }

  function resumeReading() {
    if (isPaused && speechSynthesis.paused) {
      speechSynthesis.resume();
      isPaused = false;
    }
  }

  function stopReading() {
    readingRef.current = false;
    speechSynthesis.cancel();
    utteranceRef.current = null;
    isPaused = false;
  }

  function goBack() {
    stopReading();
    window.location.href = "/library";
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
        <button ref={prevChapterRef} className="chapter-btn">Previous Chapter</button>
        <div className="settings-section">
          <label htmlFor="fontSize">Font Size</label>
          <input ref={fontSizeRef} type="range" id="fontSize" min="10" max="40" />
          <label>Highlight Color</label>
          <div className="highlight-color">
            <div className="color" style={{ backgroundColor: "red" }}></div>
            <div className="color" style={{ backgroundColor: "blue" }}></div>
            <div className="color" style={{ backgroundColor: "green" }}></div>
            <div className="color" style={{ backgroundColor: "yellow" }}></div>
            <div className="color" style={{ backgroundColor: "orange" }}></div>
          </div>
        </div>
        <button ref={nextChapterRef} className="chapter-btn">Next Chapter</button>
      </div>
    </div>
  );
}
