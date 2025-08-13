"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import builtInBooks from "../../src/content/book-list";

export default function Library() {
  const router = useRouter();

  const [uploads, setUploads] = useState([]);      // [{id,title,content,password?}, ...]
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");                  // search query

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/uploadedtext", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) setUploads(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load uploads:", e);
        if (!cancelled) setUploads([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter across both sections
  const filteredBuiltins = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return builtInBooks;
    return builtInBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(term) ||
        b.author.toLowerCase().includes(term)
    );
  }, [q]);

  const filteredUploads = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return uploads;
    return uploads.filter((u) => u.title?.toLowerCase().includes(term));
  }, [q, uploads]);

  function openBuiltin(index) {
    router.push(`/readingpal?bookIndex=${index}`);
  }

  async function openUpload(upload) {
    // If upload has a password, prompt to unlock first
    if (upload.password) {
      const pwd = window.prompt("This text is locked. Enter password to unlock:");
      if (pwd === null) return; // cancel
      try {
        const res = await fetch("/api/unlockupload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.id, password: pwd }),
        });
        if (!res.ok) {
          const msg = await res.text();
          alert(msg || "Incorrect password.");
          return;
        }
      } catch (e) {
        console.error("Unlock failed:", e);
        alert("Could not unlock this upload right now.");
        return;
      }
    }
    router.push(`/uploads/${upload.id}`);
  }

  return (
    <>
      <header id="navbar">
        <div className="navbar-inner">
          <a className="logo" href="/">
            <img src="/assets/images/learnloom.png" alt="LearnLoom Logo" className="logo-image" />
          </a>
          <ul className="nav-links">
            <li><a href="/">Home</a></li>
            <li><a href="/library">Library</a></li>
            <li><a href="/readingpal">Reading Pal</a></li>
            <li><a href="/grammar">Study Grammar</a></li>
          </ul>
          <a className="login-button" href="/dashboard">Dashboard</a>
        </div>
      </header>

      <main className="library-wrapper">
        <h1 className="library-heading">Browse Your Library</h1>

        <div className="library-search">
          <input
            type="text"
            placeholder="Search by title or author…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input"
          />
        </div>

        {/* Built-in Classics */}
        <section className="library-section">
          <h2 className="section-title">Built-in Classics</h2>
          <div className="book-grid">
            {filteredBuiltins.map((book, index) => (
              <div
                key={`builtin-${index}`}
                className="book-card"
                onClick={() => openBuiltin(index)}
                title={`${book.title} by ${book.author}`}
              >
                <img
                  className="book-cover"
                  src={book.cover}
                  alt={`${book.title} by ${book.author}`}
                />
                <p className="book-title">{book.title}</p>
                <p className="book-author">{book.author}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />

        {/* My Uploads */}
        <section className="library-section">
          <div className="uploads-header">
            <h2 className="section-title">My Uploads</h2>
            <a href="/uploads/new" className="cta-button small">New Upload</a>
          </div>

          {loading ? (
            <p>Loading your uploads…</p>
          ) : filteredUploads.length === 0 ? (
            <p>No uploads found{q ? " for your search." : "."}</p>
          ) : (
            <div className="book-grid">
              {filteredUploads.map((u) => {
                const locked = Boolean(u.password);
                return (
                  <div
                    key={`upload-${u.id}`}
                    className="book-card"
                    onClick={() => openUpload(u)}
                    title={u.title}
                  >
                    <div className="upload-cover">
                      <span className="upload-initial">
                        {u.title?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                      {locked && <span className="lock-badge" title="Locked">🔒</span>}
                    </div>
                    <p className="book-title">{u.title}</p>
                    <p className="book-author">{locked ? "Password protected" : "Unlocked"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
