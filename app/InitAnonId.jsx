"use client";

import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

export default function InitAnonId() {
  useEffect(() => {
    const existing = document.cookie
      .split("; ")
      .find((row) => row.startsWith("learnloomId="));

    if (!existing) {
      const newId = uuidv4();
      document.cookie = `learnloomId=${newId}; path=/; max-age=${60 * 60 * 24 * 90}`;
      console.log("✅ Set new anon ID:", newId);
    }
  }, []);

  return null;
}
