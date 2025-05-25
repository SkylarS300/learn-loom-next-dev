"use client";

import { useSearchParams } from "next/navigation";
import books from "../../public/Content/book-content.js";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function ReadingPalClient() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const bookIndex = searchParams.get("bookIndex");

  const readingRef = useRef(false);
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

  useEffect(() => {
    if (status !== "authenticated" || !bookIndex) return;

    currentBook = books[parseInt(bookIndex)];
    if (bookTitleRef.current) {
      bookTitleRef.current.innerText = `${currentBook.title} by ${currentBook.author}`;
    }
    displayChapter(currentBook, currentChapterIndex);

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

    document.querySelectorAll(".highlight-color .color").forEach((colorElement) => {
      colorElement.addEventListener("click", function () {
        const selectedColor = window.getComputedStyle(this).backgroundColor;
        updateHighlightColor(selectedColor);
      });
    });
  }, [status, bookIndex]);

  async function displayChapter(book, chapterIndex) {
    const chapter = book.chapters[chapterIndex];
    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) textRef.current.innerText = chapter.content;

    if (session?.user?.id) {
      await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(session.user.id),
          bookIndex: parseInt(bookIndex),
          chapterIndex: chapterIndex,
        }),
      });
    }
  }

  // ... keep the rest of the code unchanged ...
  // (readText, highlightWord, startReading, pauseReading, resumeReading, stopReading, goBack, updateHighlightColor, etc.)

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
      {/* rest of your JSX unchanged */}
    </div>
  );
}
