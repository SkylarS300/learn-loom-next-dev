"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUploadPage() {
  // ---- limits ----
  const MAX_TXT_BYTES = 1_000_000;   // ~1 MB
  const MAX_PDF_BYTES = 12_000_000;  // ~12 MB
  const [mode, setMode] = useState("typed"); // "typed" or "file"
  const [title, setTitle] = useState("");
  const [typedContent, setTypedContent] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [password, setPassword] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE"); // PRIVATE | CODED | PUBLIC
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  // Defer rendering the heavy preview box to avoid blocking typing/paint
  const [showPreview, setShowPreview] = useState(false);

  const router = useRouter();

  // Turn on preview on the next tick only when we actually have content
  useEffect(() => {
    if (!fileContent) { setShowPreview(false); return; }
    const id = setTimeout(() => setShowPreview(true), 0);
    return () => clearTimeout(id);
  }, [fileContent]);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // reset previous state/errors
    setError("");
    setFileContent("");
    setFileName(file.name);
    const reader = new FileReader();
    // Guardrails: type + size
    const type = file.type || "";
    const isPdf = type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isTxt = type === "text/plain" || /\.txt$/i.test(file.name);
    if (!isPdf && !isTxt) {
      setError("Only PDF and TXT files are supported.");
      return;
    }
    if (isPdf && file.size > MAX_PDF_BYTES) {
      setError(`PDF is too large. Max ${Math.round(MAX_PDF_BYTES / 1_000_000)} MB.`);
      return;
    }
    if (isTxt && file.size > MAX_TXT_BYTES) {
      setError(`TXT is too large. Max ${Math.round(MAX_TXT_BYTES / 1_000_000)} MB.`);
      return;
    }

    if (isPdf) {
      reader.readAsArrayBuffer(file);
      reader.onload = async () => {
        try {
          // Defer heavy lib until needed
          const pdfjs = await import("pdfjs-dist/build/pdf");
          // If your build needs an explicit worker, uncomment the next two lines and serve worker locally:
          // const worker = await import("pdfjs-dist/build/pdf.worker.min.js");
          // pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker.default]));

          const typedarray = new Uint8Array(reader.result);
          const pdf = await pdfjs.getDocument({ data: typedarray }).promise;
          let text = "";
          // Soft cap large PDFs to keep UI responsive (still succeeds; just warns)
          const MAX_PAGES_TO_PARSE = 150;
          const pages = Math.min(pdf.numPages, MAX_PAGES_TO_PARSE);
          for (let i = 1; i <= pages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((s) => s.str).join(" ") + "\n";
          }
          if (pdf.numPages > MAX_PAGES_TO_PARSE) {
            text += `\n\n[Truncated at ${MAX_PAGES_TO_PARSE} pages for performance]`;
          }
          setFileContent(text.trim());
        } catch (err) {
          console.error(err);
          setError("Could not read PDF. Try exporting as a text-based PDF or upload a TXT file.");
        }
      };
    } else if (isTxt) {
      reader.readAsText(file);
      reader.onload = () => {
        try {
          // Enforce size again after read (belt & suspenders)
          const txt = String(reader.result || "");
          if (new Blob([txt]).size > MAX_TXT_BYTES) {
            setError(`TXT is too large. Max ${Math.round(MAX_TXT_BYTES / 1_000_000)} MB.`);
            return;
          }
          setFileContent(txt.trim());
        } catch {
          setError("Could not read TXT file.");
        }
      };
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const content = mode === "typed" ? typedContent : fileContent;
    if (!title.trim()) {
      setLoading(false);
      setError("Please enter a title.");
      return;
    }
    if (!content || !content.trim()) {
      setLoading(false);
      setError(mode === "typed" ? "Please add some content." : "Please select a valid file.");
      return;
    }

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
              <input
                type="file"
                accept=".txt,application/pdf"
                onChange={handleFileUpload}
                required
              />
            </label>
            {fileName && <p>📄 <strong>{fileName}</strong> selected</p>}
            {fileContent && showPreview && (
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
