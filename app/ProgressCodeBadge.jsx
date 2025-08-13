"use client";

import { useEffect, useState } from "react";

export function ProgressCodeBadge() {
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
    <span className="progress-code">
      Progress Code: <code>{anonId.slice(0, 4)}…{anonId.slice(-4)}</code>
    </span>
  );
}
