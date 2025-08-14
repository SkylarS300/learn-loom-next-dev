"use client";

import { useEffect, useMemo, useState } from "react";
import books from "@/src/content/book-content.js";
import styles from "./library.module.css";

function BookCard({ idx, title, author, onOpen }) {
  return (
    <button
      className={styles.card}
      onClick={() => onOpen(idx)}
      aria-label={`Open ${title} by ${author}`}
    >
      <div className={styles.cardBadge}>Book</div>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardSub}>{author}</div>
    </button>
  );
}

function UploadCard({ id, title, locked }) {
  return (
    <a
      className={styles.card}
      href={`/uploads/${id}`}
      aria-label={`${locked ? "Locked upload" : "Upload"}: ${title}`}
    >
      <div className={styles.cardBadge}>
        {locked ? "🔒 Protected" : "Upload"}
      </div>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardSub}>
        {locked ? "Unlock to read" : "Open"}
      </div>
    </a>
  );
}

export default function LibraryPage() {
  const [uploads, setUploads] = useState([]);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/uploadedtext");
        const j = await r.json().catch(() => ({}));
        // Accept either {ok,data} or a raw array (dev convenience)
        const list = Array.isArray(j) ? j : j?.data ?? [];
        if (!cancelled) setUploads(list);
        if (!Array.isArray(list) && !j?.ok && !cancelled) {
          setErr(j?.error || "Failed to load uploads");
        }
      } catch {
        if (!cancelled) setErr("Failed to load uploads");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const curated = books.map((b, i) => ({
      kind: "book",
      id: i,
      title: b.title,
      author: b.author,
    }));
    const ups = (uploads || []).map((u) => ({
      kind: "upload",
      id: u.id,
      title: u.title,
      locked: !!u.locked, // server should send locked boolean (derived from password)
    }));

    const q = query.trim().toLowerCase();
    if (!q) return { curated, ups };

    const match = (s) => (s || "").toLowerCase().includes(q);
    return {
      curated: curated.filter((x) => match(x.title) || match(x.author)),
      ups: ups.filter((x) => match(x.title)),
    };
  }, [uploads, query]);

  const openBook = (idx) => {
    window.location.href = `/readingpal?bookIndex=${idx}`;
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Library</h1>
        <div className={styles.actions}>
          <a className={styles.btn} href="/uploads/new">
            + New Upload
          </a>
        </div>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          placeholder="Search titles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search titles"
        />
      </div>
      {err && <p style={{ color: "#d33" }}>{err}</p>}

      <section>
        <h3 className={styles.sectionTitle}>Curated books</h3>
        <div className={styles.grid}>
          {filtered.curated.length > 0 ? (
            filtered.curated.map((b) => (
              <BookCard
                key={`b-${b.id}`}
                idx={b.id}
                title={b.title}
                author={b.author}
                onOpen={openBook}
              />
            ))
          ) : (
            <p className={styles.dim}>No matches</p>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}>Your uploads</h3>
        <div className={styles.grid}>
          {filtered.ups.length > 0 ? (
            filtered.ups.map((u) => (
              <UploadCard
                key={`u-${u.id}`}
                id={u.id}
                title={u.title}
                locked={u.locked}
              />
            ))
          ) : (
            <p className={styles.dim}>No matches</p>
          )}
        </div>
      </section>
    </main>
  );
}
