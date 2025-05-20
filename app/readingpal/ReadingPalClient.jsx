// app/readingpal/ReadingPalClient.jsx
"use client";

import { useSearchParams } from "next/navigation";
import books from "../../public/Content/book-content.js";
import { useEffect, useRef } from "react";

export default function ReadingPalClient() {
  let highlightedColor = "yellow";
  let currentBook = null;
  let currentChapterIndex = 0;
  let utterance = null;
  let isPaused = false;
  let wordIndex = 0;

  const searchParams = useSearchParams();
  const bookIndex = searchParams.get("bookIndex");

  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);

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
  }, [bookIndex]);

  function displayChapter(book, chapterIndex) {
    const chapter = book.chapters[chapterIndex];
    if (chapterTitleRef.current) chapterTitleRef.current.innerText = chapter.chapterTitle;
    if (textRef.current) textRef.current.innerText = chapter.content;
  }

  function readText() {
    if (utterance) speechSynthesis.cancel();
    let text = currentBook.chapters[currentChapterIndex].content;
    let paragraphs = text.split(/\n\s*\n|\n/);
    if (paragraphs.length === 1) {
      paragraphs = text.match(/(.{1,500})(\s|$)/g);
    }
    let paragraphIndex = 0;

    function speakNextParagraph() {
      if (paragraphIndex < paragraphs.length) {
        const paragraphText = paragraphs[paragraphIndex];
        const words = paragraphText.split(/\s+/);
        let wordIndex = 0;
        const utterance = new SpeechSynthesisUtterance(paragraphText);

        utterance.onboundary = (event) => {
          if (event.name === "word" && wordIndex < words.length) {
            highlightWord(wordIndex, words);
            wordIndex++;
          }
        };

        utterance.onend = () => {
          paragraphIndex++;
          setTimeout(speakNextParagraph, 50);
        };

        speechSynthesis.speak(utterance);
      }
    }

    speakNextParagraph();
  }

  function updateHighlightColor(color) {
    highlightedColor = color;
    console.log("Highlight color updated to:", highlightedColor);
  }

  function highlightWord(wordIndex, words) {
    const paragraphElement = textRef.current;
    const paragraphText = words.join(" ");
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
    if (!isPaused || utterance) {
      speechSynthesis.cancel();
    }
  }

  function goBack() {
    stopReading();
    window.location.href = "/library";
  }

  return (
    <div>
      <h1 ref={bookTitleRef} id="bookTitle">Book Title</h1>
      <div id="bookPopup">
        <button className="close-btn" onClick={goBack}>&#x2716;</button>
        <h2 ref={chapterTitleRef} id="chapterTitle">Chapter Title</h2>
        <div ref={textRef} id="text">
          The chapter text will appear here after selecting a book from the library.
        </div>
        <div className="control-buttons">
          <button onClick={startReading}>Start Reading</button>
          <button onClick={pauseReading}>Pause</button>
          <button onClick={resumeReading}>Resume</button>
          <button onClick={stopReading}>Stop</button>
        </div>

        <div className="chapter-nav">
          <button ref={prevChapterRef} id="prevChapter">Previous Chapter</button>

          <div className="settings-section">
            <label htmlFor="fontSize">Font Size</label>
            <input type="range" id="fontSize" name="fontSize" min="10" max="40" ref={fontSizeRef} />

            <label>Highlight Color</label>
            <div className="highlight-color">
              {["red", "blue", "green", "yellow", "orange"].map((color) => (
                <div
                  key={color}
                  className={`color ${color}`}
                  onClick={() => updateHighlightColor(color)}
                ></div>
              ))}
            </div>
          </div>

          <button ref={nextChapterRef} id="nextChapter">Next Chapter</button>
        </div>
      </div>
    </div>
  );
}