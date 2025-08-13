"use client";
import { useEffect, useState } from "react";

// Optional: Add your own word list
const wordList = ["SUN", "FOX", "LEAF", "MOON", "OWL", "BEE", "SNOW", "LAVA", "TULIP", "WIND"];

function prettifyAnonId(anonId) {
  if (!anonId || anonId.length < 8) return anonId;

  // Use parts of the UUID as indices
  const hash = anonId.replace(/-/g, "");
  const i1 = parseInt(hash.slice(0, 4), 16) % wordList.length;
  const i2 = parseInt(hash.slice(4, 8), 16) % wordList.length;
  const i3 = parseInt(hash.slice(8, 12), 16) % 1000;

  return `${wordList[i1]}-${i3.toString().padStart(3, "0")}-${wordList[i2]}`;
}

export default function ProgressCodeBanner() {
  const [anonId, setAnonId] = useState("");

  useEffect(() => {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("learnloomId="));
    if (match) {
      setAnonId(match.split("=")[1]);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(anonId);
    alert("Progress Code copied!");
  };

  const display = prettifyAnonId(anonId);

  if (!anonId) return null;

  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <h2>📊 LearnLoom Dashboard</h2>
      <p>
        Your Progress Code:{" "}
        <code style={{ fontWeight: "bold", fontSize: "1.05rem" }}>{display}</code>{" "}
        <button
          onClick={handleCopy}
          style={{
            fontSize: "0.8rem",
            padding: "0.2rem 0.6rem",
            marginLeft: "0.5rem",
            cursor: "pointer",
          }}
        >
          Copy
        </button>
      </p>
    </div>
  );
}
