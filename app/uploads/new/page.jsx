"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUploadPage() {
  const [mode, setMode] = useState("typed"); // "typed" or "file"
  const [title, setTitle] = useState("");
  const [typedContent, setTypedContent] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [password, setPassword] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE"); // PRIVATE | CODED | PUBLIC
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    if (file.type === "application/pdf") {
      reader.readAsArrayBuffer(file);
      reader.onload = async () => {
        const pdfjsLib = await import("pdfjs-dist");
        const typedarray = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((s) => s.str).join(" ") + "\n";
        }
        setFileContent(text.trim());
      };
    } else if (file.type === "text/plain") {
      reader.readAsText(file);
      reader.onload = () => {
        setFileContent(reader.result.trim());
      };
    } else {
      setError("Only PDF and TXT files are supported.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const content = mode === "typed" ? typedContent : fileContent;

    const res = await fetch("/api/uploadedtext", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, password, visibility }),
    });

    setLoading(false);
    if (res.ok) {
      const j = await res.json().catch(() => null);
      const newId = j?.data?.id ?? j?.id; // support both shapes
      if (newId) {
        router.push(`/uploads/${newId}`);
      } else {
        setError("Upload succeeded but response had no ID.");
      }
    } else {
      setError("Failed to upload text.");
    }
  }

  return (
    <section className="upload-form" style={{ maxWidth: "700px", margin: "0 auto" }}>
      <h1>📤 Upload New Text</h1>

      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => setMode("typed")}
          className={mode === "typed" ? "active-tab" : ""}
        >
          📝 Type Text
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={mode === "file" ? "active-tab" : ""}
        >
          📁 Upload File
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Title:
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        {mode === "typed" && (
          <label>
            Content:
            <textarea
              value={typedContent}
              onChange={(e) => setTypedContent(e.target.value)}
              placeholder="Paste or type your text here..."
              rows={12}
              required
            />
          </label>
        )}

        {mode === "file" && (
          <>
            <label>
              Upload a .txt or .pdf file:
              <input type="file" accept=".txt,.pdf" onChange={handleFileUpload} required />
            </label>
            {fileName && <p>📄 <strong>{fileName}</strong> selected</p>}
            {fileContent && (
              <pre
                style={{
                  background: "#f9f9f9",
                  border: "1px solid #ccc",
                  padding: "1rem",
                  maxHeight: "200px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {fileContent.slice(0, 2000) + (fileContent.length > 2000 ? "..." : "")}
              </pre>
            )}
          </>
        )}

        <label>
          Optional Password (to lock upload):
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep unlocked"
          />
        </label>

        <label>
          Visibility:
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="PRIVATE">Private (only you)</option>
            <option value="PUBLIC">Public (listed in Community)</option>
            <option value="CODED">Share code (not listed; show by code)</option>
          </select>
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>

      <style jsx>{`
        .active-tab {
          font-weight: bold;
          background: #0070f3;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          margin-right: 0.5rem;
          border-radius: 6px;
          cursor: pointer;
        }

        button:not(.active-tab) {
          background: #eee;
          border: 1px solid #ccc;
          padding: 0.5rem 1rem;
          margin-right: 0.5rem;
          border-radius: 6px;
          cursor: pointer;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        input,
        textarea {
          width: 100%;
          padding: 0.5rem;
          font-size: 1rem;
        }

        label {
          font-weight: 500;
        }

        button[type="submit"] {
          background: #0070f3;
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
        }
      `}</style>
    </section>
  );
}
