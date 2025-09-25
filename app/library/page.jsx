"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Navbar from "../Navbar";
import books from "@/src/content/book-content.js";
import styles from "./library.module.css";

/* ------------ helpers ------------ */
function coverFor(book) {
  if (book?.cover) return book.cover.startsWith("/") ? book.cover : `/assets/images/${book.cover}`;
  const map = {
    "Alice's Adventures in Wonderland": "cover_alice.jpg",
    Dracula: "cover_drac.jpg",
    Frankenstein: "cover_frank.jpg",
    "Great Expectations": "cover_greatexp.jpg",
    "Jane Eyre": "cover_je.jpg",
    Metamorphosis: "cover_m.jpg",
    "Oliver Twist": "cover_ot.jpg",
    "Pride and Prejudice": "cover_pap.jpg",
    "Treasure Island": "cover_tim.jpg",
    "The Time Machine": "cover_ttm.jpg",
    "Wuthering Heights": "cover_wh.jpg",
    "The War of the Worlds": "cover_witw.jpg",
    "The Invisible Man": "cover_tim.jpg",
    "The Wind in the Willows": "cover_witw.jpg",
  };
  const file = map[book?.title] || "empty-book.png";
  return `/assets/images/${file}`;
}

// humanize timestamps
function timeAgo(d) {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}


function BookCard({ idx, title, author, cover, onOpen }) {
  return (
    <button className={styles.card} onClick={() => onOpen(idx)} aria-label={`Open ${title} by ${author}`}>
      <div className={styles.coverWrap}>
        <img src={cover} alt={`${title} cover`} className={styles.cover} />
      </div>
      <div className={styles.cardBadge}>Book</div>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardSub}>{author}</div>
    </button>
  );
}


function UploadCard({ id, title, locked, badge = "Upload", href, viewedAt }) {
  const sub = viewedAt
    ? `Last viewed ${timeAgo(viewedAt)}`
    : (locked ? "Unlock to read" : "Open");
  return (
    <a className={styles.card} href={href || `/uploads/${id}`} aria-label={`${locked ? "Locked upload" : "Upload"}: ${title}`}>
      <div className={styles.cardBadge}>{badge}{locked ? " • 🔒" : ""}</div>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardSub}>{sub}</div>
    </a>
  );
}

/* ------------ page ------------ */
export default function LibraryPage() {
  const [uploads, setUploads] = useState([]);       // yours
  const [community, setCommunity] = useState([]);   // public/coded
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [savedCodes, setSavedCodes] = useState([]);
  const [codesVersion, setCodesVersion] = useState(0);
  const [err, setErr] = useState("");

  const [toast, setToast] = useState("");


  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);


  // tabs: All / Community / Yours
  const [tab, setTab] = useState("All");
  const tabBarRef = useRef(null);

  /* --- load yours --- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/uploadedtext?scope=mine");
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j) ? j : j?.data ?? [];
        if (!cancelled) setUploads(list);
      } catch {
        if (!cancelled) setUploads([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* --- initial community --- */
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

  /* --- saved codes --- */
  async function refreshSavedCodes() {
    try {
      const r = await fetch("/api/sharecode");
      const j = await r.json();
      if (j?.ok) setSavedCodes(j.data || []);
    } catch { }
  }
  useEffect(() => { refreshSavedCodes(); }, []);

  /* --- refetch community on code change --- */
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
          setNextCursor(j?.nextCursor || null);
        }
        if (!cancelled) refreshSavedCodes();
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [shareCode, codesVersion]);

  /* --- load more --- */
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

  const toArray = (maybe) => (Array.isArray(maybe) ? maybe : Array.isArray(maybe?.data) ? maybe.data : []);

  const filtered = useMemo(() => {
    const curated = books.map((b, i) => ({ kind: "book", id: i, title: b.title, author: b.author, cover: coverFor(b) }));
    const ups = toArray(uploads).map((u) => ({
      kind: "upload",
      id: u.id,
      title: u.title,
      locked: !!u.locked,
      viewedAt: u.viewedAt || null,
    }));
    const comm = toArray(community).map((u) => ({
      id: u.id, title: u.title, locked: !!u.locked, visibility: u.visibility, shareCode: u.shareCode || null,
    }));
    const q = query.trim().toLowerCase();
    const match = (s) => (s || "").toLowerCase().includes(q);

    return {
      curated: q ? curated.filter((x) => match(x.title) || match(x.author)) : curated,
      ups: q ? ups.filter((x) => match(x.title)) : ups,
      comm: q ? comm.filter((x) => match(x.title) || match(x.shareCode)) : comm,
    };
  }, [uploads, community, query]);

  const openBook = (idx) => { window.location.href = `/readingpal?bookIndex=${idx}`; };

  /* --- small animated indicator for tabs --- */
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const btns = [...bar.querySelectorAll("[role=tab]")];
    const active = btns.find((b) => b.getAttribute("aria-selected") === "true");
    const ind = bar.querySelector(`.${styles.tabIndicator}`);
    if (!(active && ind)) return;
    const rect = active.getBoundingClientRect();
    const parentRect = bar.getBoundingClientRect();
    ind.style.setProperty("--ti-x", `${rect.left - parentRect.left}px`);
    ind.style.setProperty("--ti-w", `${rect.width}px`);
  }, [tab, query, shareCode, filtered]);

  return (
    <>
      <Navbar />
      <main className={styles.wrap}>
        {toast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111827",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              zIndex: 50
            }}
          >
            {toast}
          </div>
        )}

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

        {/* Tabs */}
        <div className={styles.tabs}>
          <div className={styles.tablist} ref={tabBarRef} role="tablist" aria-label="Browse uploads">
            {["All", "Community", "Yours"].map((t) => (
              <button
                key={t}
                role="tab"
                className={styles.tab}
                aria-selected={String(tab === t)}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
            <div className={styles.tabIndicator} />
          </div>

          {/* Tab Panels */}
          {tab === "All" && (
            <div className={styles.tabPanel}>
              <h3 className={styles.sectionTitle}>Curated books</h3>
              <div className={styles.grid}>
                {filtered.curated.length ? (
                  filtered.curated.map((b) => (
                    <BookCard key={`b-${b.id}`} idx={b.id} title={b.title} author={b.author} cover={b.cover} onOpen={openBook} />
                  ))
                ) : (
                  <p className={styles.dim}>No matches</p>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
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
                      await refreshSavedCodes();
                      setToast("Code saved");
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
                        setToast("Codes cleared");
                        setCodesVersion((v) => v + 1);
                      }}
                      aria-label="Clear all saved codes"
                    >
                      Clear codes
                    </button>
                  )}
                </div>
              </div>

              {savedCodes.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 12px" }}>
                  {savedCodes.map((c) => (
                    <span key={c} style={{ border: "1px solid #d9e3ff", background: "#f1f5ff", color: "#0b3b9f", borderRadius: 999, padding: "2px 8px" }}>
                      {c}
                      <button
                        onClick={async () => {
                          await fetch(`/api/sharecode?code=${encodeURIComponent(c)}`, { method: "DELETE" });
                          setSavedCodes((prev) => prev.filter((x) => x !== c));
                          setShareCode("");
                          setToast("Code removed");
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
                {community.length ? (
                  community.map((u) => {
                    const href =
                      u.visibility === "CODED" && shareCode.trim()
                        ? `/uploads/${u.id}?code=${encodeURIComponent(shareCode.trim())}`
                        : `/uploads/${u.id}`;
                    return (
                      <UploadCard
                        key={`c-${u.id}`}
                        id={u.id}
                        title={u.title}
                        locked={!!u.locked}
                        badge={u.visibility === "PUBLIC" ? "Public" : "Code required"}
                        href={href}
                      />
                    );
                  })
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

              <h3 className={styles.sectionTitle} style={{ marginTop: 24 }}>Your uploads</h3>
              <div className={styles.grid}>
                {filtered.ups.length ? (
                  filtered.ups.map((u) => (
                    <UploadCard
                      key={`u-${u.id}`}
                      id={u.id}
                      title={u.title}
                      locked={u.locked}
                      viewedAt={u.viewedAt}
                    />

                  ))
                ) : (
                  <p className={styles.dim}>No matches</p>
                )}
              </div>
            </div>
          )}

          {tab === "Community" && (
            <div className={styles.tabPanel}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Community uploads</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <input
                    className={styles.search}
                    style={{ maxWidth: 200 }}
                    placeholder="Have a share code?"
                    value={shareCode}
                    onChange={(e) => setShareCode((e.target.value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))}
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
                      await refreshSavedCodes();
                      setToast("Code saved");
                      setCodesVersion((v) => v + 1);
                    }}
                  >
                    Save code
                  </button>
                </div>
              </div>
              <div className={styles.grid}>
                {community.length ? (
                  community.map((u) => (
                    <UploadCard
                      key={`c-${u.id}`}
                      id={u.id}
                      title={u.title}
                      locked={!!u.locked}
                      badge={u.visibility === "PUBLIC" ? "Public" : "Code required"}
                      href={
                        u.visibility === "CODED" && shareCode.trim()
                          ? `/uploads/${u.id}?code=${encodeURIComponent(shareCode.trim())}`
                          : `/uploads/${u.id}`
                      }
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
            </div>
          )}

          {tab === "Yours" && (
            <div className={styles.tabPanel}>
              <div className={styles.grid}>
                {filtered.ups.length ? (
                  filtered.ups.map((u) => (
                    <UploadCard
                      key={`u-${u.id}`}
                      id={u.id}
                      title={u.title}
                      locked={u.locked}
                      viewedAt={u.viewedAt}
                    />
                  ))
                ) : (
                  <p className={styles.dim}>No matches</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
