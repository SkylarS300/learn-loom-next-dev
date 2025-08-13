"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SyncClient({ anonId }) {
  const router = useRouter();

  useEffect(() => {
    if (!anonId || anonId.length < 10) return;

    document.cookie = `learnloomId=${anonId}; path=/; max-age=${60 * 60 * 24 * 90}`;
    setTimeout(() => {
      router.replace("/dashboard");
    }, 1200); // Short delay to show spinner
  }, [anonId]);

  if (!anonId || anonId.length < 10) return <p>Invalid Progress Code</p>;

  return (
    <div style={{ textAlign: "center", paddingTop: "3rem" }}>
      <h2>🔄 Syncing your progress…</h2>
      <p>You’ll be redirected shortly.</p>
    </div>
  );
}
