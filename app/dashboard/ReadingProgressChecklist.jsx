"use client";
import { useEffect, useState } from "react";
import books from "/src/content/book-content.js";
import Link from "next/link";

export default function ReadingProgressChecklist() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/readingprogress")
      .then((res) => res.json())
      .then(setProgress)
      .catch(() => setProgress([]))
      .finally(() => setLoading(false));
  }, []);

  // Create a map: bookIndex -> list of completed chapters
  const chapterMap = new Map();
  progress.forEach(({ bookIndex, chapterIndex }) => {
    if (!chapterMap.has(bookIndex)) chapterMap.set(bookIndex, new Set());
    chapterMap.get(bookIndex).add(chapterIndex);
  });

  if (loading) return <p>📖 Loading reading progress...</p>;

  return (
    <section className="dashboard-section">
      <h3>📚 Reading Progress</h3>
      <ul className="reading-list">
        {books.map((book, index) => {
          const chaptersRead = chapterMap.get(index)?.size || 0;
          const totalChapters = book.chapters.length;
          const isStarted = chaptersRead > 0;
          const latestChapter = Math.max(...(chapterMap.get(index) || [0]));

          return (
            <li key={index} className="reading-row">
              <strong>{book.title}</strong>
              <span style={{ marginLeft: "1rem" }}>
                {isStarted ? (
                  <>
                    ✅ {chaptersRead}/{totalChapters} chapters
                    {" — "}
                    <Link href={`/readingpal?bookIndex=${index}`}>
                      Resume at Chapter {latestChapter + 1}
                    </Link>
                  </>
                ) : (
                  <span style={{ color: "red" }}>❌ Not started</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
