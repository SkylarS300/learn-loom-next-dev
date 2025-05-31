"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProgressCodeBanner from "/app/dashboard/ProgressCodeBanner.jsx";
import UploadedTexts from "./UploadedTexts";
import GrammarQuizHistory from "./GrammarQuizHistory";
import ReadingProgressChecklist from "./ReadingProgressChecklist";
import ReadingProgressChart from "./ReadingProgressChart";
import GrammarScoreChart from "./GrammarScoreChart";
import QuickResume from "./QuickResume";

function ResumeLastUpload() {
  const [upload, setUpload] = useState(null);

  useEffect(() => {
    fetch("/api/uploadview")
      .then((res) => res.json())
      .then((data) => {
        if (data.latest?.uploadedtext) {
          setUpload(data.latest.uploadedtext);
        }
      });
  }, []);

  if (!upload) return null;

  return (
    <div className="resume-panel">
      <h3>📤 Resume Your Last Upload</h3>
      <p><strong>{upload.title}</strong></p>
      <Link href={`/uploads/${upload.id}`}>
        <button className="cta-button">Resume Reading</button>
      </Link>
    </div>
  );
}


// 🔐 Progress Code Display
function ProgressCodeBadge() {
  const [anonId, setAnonId] = useState("");

  useEffect(() => {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("learnloomId="));
    if (match) {
      const id = match.split("=")[1];
      setAnonId(id);
    }
  }, []);

  if (!anonId) return null;

  return (
    <div className="progress-code-badge" style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#888" }}>
      Progress Code: <code>{anonId.slice(0, 4)}…{anonId.slice(-4)}</code>
    </div>
  );
}

export default function UnifiedDashboard() {
  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h2 className="logo">LearnLoom</h2>
        <span className="header-title">Dashboard</span>
        <nav className="dashboard-nav" style={{ marginLeft: "auto", marginRight: "1rem" }}>
          <Link href="/library">Library</Link>{" | "}
          <Link href="/readingpal">Reading Pal</Link>{" | "}
          <Link href="/grammar">Grammar</Link>{" | "}
          <Link href="/uploads">My Uploads</Link>
        </nav>
      </header>

      <div className="dashboard-content">
        <ProgressCodeBanner />

        <h1>Welcome to LearnLoom</h1>
        <p>Your progress is saved anonymously using your Progress Code.</p>

        <ul className="feature-list">
          <li>📖 Explore the <Link href="/library">Book Library</Link></li>
          <li>🗣️ Use <Link href="/readingpal">Reading Pal</Link> for TTS and highlights</li>
          <li>🧪 Practice grammar with <Link href="/grammar">quizzes</Link></li>
          <li>📤 Upload your own files in <Link href="/uploads">My Uploads</Link></li>
        </ul>

        <hr className="divider" />

        {/* ✅ Call it here */}
        <ResumeLastUpload />

        <QuickResume />
        <UploadedTexts />
        <GrammarQuizHistory />
        <ReadingProgressChecklist />
        <ReadingProgressChart />
        <GrammarScoreChart />
      </div>
    </div>
  );
}
