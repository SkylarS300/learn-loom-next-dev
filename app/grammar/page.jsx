"use client";
import { Suspense } from "react";
import GrammarClient from "./GrammarClient";

export default function GrammarPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 520, margin: "32px auto", padding: 16 }}>
          <h1>Loading grammar…</h1>
          <p style={{ color: "#6b7280" }}>Please wait.</p>
        </main>
      }
    >
      <GrammarClient />
    </Suspense>
  );
}