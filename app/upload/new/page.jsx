"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/uploadedtext", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, password }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/uploads/${data.id}`);
    } else {
      setError("Failed to upload text.");
    }
  }

  return (
    <section className="upload-form">
      <h1>📤 Upload New Text</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Title:
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Content:
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required />
        </label>
        <label>
          Optional Password (to lock upload):
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep unlocked"
          />
        </label>
        <button type="submit">Upload</button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </section>
  );
}
