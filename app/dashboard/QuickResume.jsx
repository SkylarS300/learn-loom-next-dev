"use client";
import { useEffect, useState } from "react";
import books from "/src/content/book-content.js";
import Link from "next/link";

export default function QuickResume() {
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quickresume")
      .then((res) => res.json())
      .then(setResumeData)
      .catch(() => setResumeData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>⚡ Loading resume panel...</p>;
  if (!resumeData) return null;

  const { latestRead, latestUpload, latestQuiz } = resumeData;

  return (
    <section className="dashboard-section" style={{ background: "#f9f9f9", padding: "1rem", borderRadius: "8px" }}>
      <h3>⚡ Quick Resume</h3>
      <ul className="quick-resume-list">
        {latestRead && (
          <li>
            📖 Continue reading <strong>{books[latestRead.bookIndex]?.title || "Unknown Book"}</strong> —
            <Link href={`/readingpal?bookIndex=${latestRead.bookIndex}`}>
              Resume at Chapter {latestRead.chapterIndex + 1}
            </Link>
          </li>
        )}
        {latestUpload && (
          <li>
            📤 Reopen your last upload —
            <Link href={`/uploads/${latestUpload.id}`}>
              {latestUpload.title}
            </Link>
          </li>
        )}
        {latestQuiz && (
          <li>
            🧪 Practice more grammar —
            <Link href="/grammar">
              {latestQuiz.concept} — {latestQuiz.subTopic}
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}
