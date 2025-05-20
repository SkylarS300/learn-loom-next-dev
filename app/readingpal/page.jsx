"use client";

import { useSearchParams } from "next/navigation";
import books from "../../public/Content/book-content.js";
import { useEffect, useRef } from "react";

export default function ReadingPal() {
  let highlightedColor = "yellow";
  let currentBook = null;
  let currentChapterIndex = 0;
  let utterance = null;
  let isPaused = false;
  let wordIndex = 0;

    // Parse the react link to get the bookIndex
  const searchParams = useSearchParams();
  const bookIndex = searchParams.get("bookIndex");


  // REFERENCES
  const bookTitleRef = useRef(null);
  const chapterTitleRef = useRef(null);
  const textRef = useRef(null);
  const fontSizeRef = useRef(null);
  const prevChapterRef = useRef(null);
  const nextChapterRef = useRef(null);

  // Load the selected book
  useEffect(() => {
    if (bookTitleRef.current && bookIndex !== null) {
      currentBook = books[parseInt(bookIndex)];

      bookTitleRef.innerText = `${currentBook.title} by ${currentBook.author}`;
      displayChapter(currentBook, currentChapterIndex);
    }

    // Add functionality to change font size
    if (fontSizeRef.current) {
      fontSizeRef.current.addEventListener("input", function () {
        const newSize = this.value + "px";
        textRef.style.fontSize = newSize;
      });
    }

    // Navigate to the previous chapter
    if (prevChapterRef.current) {
      prevChapterRef.current.addEventListener("click", () => {
        if (currentChapterIndex > 0) {
          stopReading();
          currentChapterIndex--;
          displayChapter(currentBook, currentChapterIndex);
        }
      });
    }

    // Navigate to the next chapter
    if (nextChapterRef.current) {
      nextChapterRef.current.addEventListener("click", () => {
        if (currentChapterIndex < currentBook.chapters.length - 1) {
          stopReading();
          currentChapterIndex++;
          displayChapter(currentBook, currentChapterIndex);
        }
      });
    }
  }, []);

  // Parse the query string to get the bookIndex
  // const queryString = window.location.search;
  // const urlParams = new URLSearchParams(queryString);
  // const bookIndex = urlParams.get("bookIndex");

  // Display the current chapter
  function displayChapter(book, chapterIndex) {
    const chapter = book.chapters[chapterIndex];
    chapterTitleRef.innerText = chapter.chapterTitle;
    textRef.innerText = chapter.content;
  }

  // Read the current text
  function readText() {
    if (utterance) {
      speechSynthesis.cancel(); // Stop any ongoing speech
    }

    let text = currentBook.chapters[currentChapterIndex].content;
    // Split the text into paragraphs based on double newlines or single newlines
    let paragraphs = text.split(/\n\s*\n|\n/);

    // Fallback: If no paragraphs found, split by a character limit (500 characters)
    if (paragraphs.length === 1) {
      paragraphs = text.match(/(.{1,500})(\s|$)/g); // Split every 500 characters
    }

    let paragraphIndex = 0;

    function speakNextParagraph() {
      if (paragraphIndex < paragraphs.length) {
        const paragraphText = paragraphs[paragraphIndex];
        const words = paragraphText.split(/\s+/); // Split paragraph into words
        let wordIndex = 0;

        const utterance = new SpeechSynthesisUtterance(paragraphText);

        utterance.onboundary = (event) => {
          if (event.name === "word" && wordIndex < words.length) {
            highlightWord(wordIndex, words); // Highlight the current word
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

  // Update highlightedColor when a color is selected
  function updateHighlightColor(color) {
    highlightedColor = color;
    console.log("Highlight color updated to:", highlightedColor);
  }

  // Add event listeners to all the color elements
  document
    .querySelectorAll(".highlight-color .color")
    .forEach((colorElement) => {
      colorElement.addEventListener("click", function () {
        const selectedColor = window.getComputedStyle(this).backgroundColor;
        updateHighlightColor(selectedColor);
      });
    });

  // Function to highlight the currently spoken word
  function highlightWord(wordIndex, words) {
    const paragraphElement = textRef;
    const paragraphText = words.join(" ");

    paragraphElement.innerHTML = ""; // Clear the text

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

  // Start reading the current chapter
  function startReading() {
    if (currentBook) {
      readText();
    }
  }

  // Pause reading
  function pauseReading() {
    if (!isPaused && speechSynthesis.speaking) {
      speechSynthesis.pause();
      isPaused = true;
    }
  }

  // Resume reading
  function resumeReading() {
    if (isPaused && speechSynthesis.paused) {
      speechSynthesis.resume();
      isPaused = false;
    }
  }

  // Stop reading
  function stopReading() {
    if (!isPaused || utterance) {
      speechSynthesis.cancel();
    }
  }

  // Go back to the book selection page
  function goBack() {
    stopReading();
    window.location.href = "library.html"; // Go back to book selection
  }

  return (
    <div>
      <h1 ref={bookTitleRef} id="bookTitle">
        Book Title
      </h1>
      <div id="bookPopup">
        <button className="close-btn" onclick="goBack()">
          &#x2716;
        </button>
        <h2 ref={chapterTitleRef} id="chapterTitle">
          Chapter Title
        </h2>
        <div ref={textRef} id="text">
          The chapter text will appear here after selecting a book from the
          library.
        </div>
        <div className="control-buttons">
          <button onclick="startReading()">Start Reading</button>
          <button onclick="pauseReading()">Pause</button>
          <button onclick="resumeReading()">Resume</button>
          <button onclick="stopReading()">Stop</button>
        </div>

        <div className="chapter-nav">
          <button ref={prevChapterRef} id="prevChapter">
            Previous Chapter
          </button>

          <div className="settings-section">
            <label ref={fontSizeRef} for="fontSize">
              Font Size
            </label>
            <input
              type="range"
              id="fontSize"
              name="fontSize"
              min="10"
              max="40"
            />

            <label>Highlight Color</label>
            <div className="highlight-color">
              <div className="color red"></div>
              <div className="color blue"></div>
              <div className="color green"></div>
              <div className="color yellow"></div>
              <div className="color orange"></div>
            </div>
          </div>

          <button ref={nextChapterRef} id="nextChapter">
            Next Chapter
          </button>
        </div>
      </div>
    </div>
  );
}
