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
  const [uploads, setUploads] = useState([]);       // YOUR uploads
  const [community, setCommunity] = useState([]);   // PUBLIC/CODED community
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [savedCodes, setSavedCodes] = useState([]);
  const [codesVersion, setCodesVersion] = useState(0); // bump to refetch community
  const [err, setErr] = useState("");

  // --- Load YOUR uploads (scope=mine). If your API differs, tell me and I’ll adjust.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/uploadedtext?scope=mine");
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j) ? j : j?.data ?? [];
        if (!cancelled) setUploads(list);
      } catch {
        // fall back; section will just show "No matches"
        if (!cancelled) setUploads([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initial community load (PUBLIC) with pagination support
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ scope: "public", limit: "24" });
        const r = await fetch(`/api/uploadedtext?${qs.toString()}`);
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j) ? j : j?.data ?? [];
        if (!cancelled) {
          setCommunity(list);
          setNextCursor(j?.nextCursor || null);
        }
        if (!Array.isArray(list) && !j?.ok && !cancelled) {
          setErr(j?.error || "Failed to load uploads");
        }
      } catch {
        if (!cancelled) setErr("Failed to load uploads");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load saved codes (chips)
  async function refreshSavedCodes() {
    try {
      const r = await fetch("/api/sharecode");
      const j = await r.json();
      if (j?.ok) setSavedCodes(j.data || []);
    } catch { /* no-op */ }
  }
  useEffect(() => {
    refreshSavedCodes();
  }, []);

  // Re-load community when share code or codesVersion changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ scope: "public", limit: "24" });
        if (shareCode.trim()) qs.set("code", shareCode.trim());
        const r = await fetch(`/api/uploadedtext?${qs.toString()}`);
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j) ? j : j?.data ?? [];
        if (!cancelled) {
          setCommunity(list);
          setNextCursor(j?.nextCursor || null); // keep pagination in sync
        }
        if (!cancelled) refreshSavedCodes();
      } catch { /* no-op */ }
    })();
    return () => { cancelled = true; };
  }, [shareCode, codesVersion]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ scope: "public", limit: "24", cursor: nextCursor });
      if (shareCode.trim()) qs.set("code", shareCode.trim());
      const r = await fetch(`/api/uploadedtext?${qs.toString()}`);
      const j = await r.json();
      const list = Array.isArray(j) ? j : j?.data ?? [];
      setCommunity((prev) => [...prev, ...list]);
      setNextCursor(j?.nextCursor || null);
    } finally {
      setLoadingMore(false);
    }
  }

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
      locked: !!u.locked,
    }));
    const comm = (community || []).map((u) => ({
      id: u.id,
      title: u.title,
      locked: !!u.locked,
      visibility: u.visibility,
      shareCode: u.shareCode || null,
    }));

    const q = query.trim().toLowerCase();
    if (!q) return { curated, ups, comm };

    const match = (s) => (s || "").toLowerCase().includes(q);
    return {
      curated: curated.filter((x) => match(x.title) || match(x.author)),
      ups: ups.filter((x) => match(x.title)),
      comm: comm.filter((x) => match(x.title) || match(x.shareCode)),
    };
  }, [uploads, community, query]);

  const openBook = (idx) => {
    window.location.href = `/readingpal?bookIndex=${idx}`;
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Library</h1>
        <div className={styles.actions}>
          <a className={styles.btn} href="/uploads/new">+ New Upload</a>
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
      {err && <p style={{ color: "#d33" }} aria-live="polite">{err}</p>}

      {/* Curated books */}
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

        {nextCursor && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button className={styles.btn} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </section>

      {/* Community uploads */}
      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Community uploads</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <input
              className={styles.search}
              style={{ maxWidth: 200 }}
              placeholder="Have a share code?"
              value={shareCode}
              onChange={(e) => {
                const v = (e.target.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                setShareCode(v);
              }}
              aria-label="Enter share code"
            />
            <button
              className={styles.btn}
              onClick={async () => {
                const code = (shareCode || "").trim();
                if (!code) return;
                await fetch("/api/sharecode", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code }),
                });
                refreshSavedCodes();
                setCodesVersion((v) => v + 1);
              }}
              aria-label="Save share code"
            >
              Save code
            </button>
            {savedCodes.length > 0 && (
              <button
                className={styles.btn}
                onClick={async () => {
                  await fetch("/api/sharecode", { method: "DELETE" });
                  setSavedCodes([]);
                  setShareCode("");
                  setCodesVersion((v) => v + 1);
                }}
                aria-label="Clear all saved codes"
              >
                Clear codes
              </button>
            )}
          </div>
        </div>

        <p className={styles.dim} style={{ margin: "6px 0 10px" }}>
          Shows PUBLIC uploads from everyone. Enter a code to reveal a CODED title.
        </p>

        {savedCodes.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
            {savedCodes.map((c) => (
              <span key={c} style={{ border: "1px solid #d9e3ff", background: "#f1f5ff", color: "#0b3b9f", borderRadius: 999, padding: "2px 8px" }}>
                {c}
                <button
                  onClick={async () => {
                    await fetch(`/api/sharecode?code=${encodeURIComponent(c)}`, { method: "DELETE" });
                    setSavedCodes((prev) => prev.filter((x) => x !== c));
                    setShareCode("");
                    setCodesVersion((v) => v + 1);
                  }}
                  aria-label={`Remove code ${c}`}
                  style={{ marginLeft: 6, border: "none", background: "transparent", cursor: "pointer" }}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          {community.length > 0 ? (
            community.map((u) => {
              const href =
                u.visibility === "CODED" && shareCode.trim()
                  ? `/uploads/${u.id}?code=${encodeURIComponent(shareCode.trim())}`
                  : `/uploads/${u.id}`;
              return (
                <a key={`c-${u.id}`} className={styles.card} href={href}>
                  <div className={styles.cardBadge}>
                    {u.visibility === "PUBLIC" ? "Public" : "Code required"}
                    {u.locked ? " • 🔒" : ""}
                  </div>
                  <div className={styles.cardTitle}>{u.title}</div>
                  <div className={styles.cardSub}>{u.locked ? "Unlock to read" : "Open"}</div>
                </a>
              );
            })
          ) : (
            <p className={styles.dim}>No matches</p>
          )}
        </div>
      </section>

      {/* Your uploads */}
      <section style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}>Your uploads</h3>
        <div className={styles.grid}>
          {filtered.ups.length > 0 ? (
            filtered.ups.map((u) => (
              <UploadCard key={`u-${u.id}`} id={u.id} title={u.title} locked={u.locked} />
            ))
          ) : (
            <p className={styles.dim}>No matches</p>
          )}
        </div>
      </section>
    </main>
  );
}
