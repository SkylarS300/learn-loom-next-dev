// app/dashboard/NotesPanel.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import styles from "./Dashboard.module.css";
import books from "@/src/content/book-content.js";
import NotesModal from "../readingpal/NotesModal";
import { track } from "@/lib/rum";

function titleForNote(n) {
    if (n.targetType === "book" && Number.isInteger(n.bookIndex)) {
        const b = books?.[n.bookIndex];
        const bookTitle = b?.title ? `${b.title}` : `Book #${n.bookIndex}`;
        const ch = Number.isInteger(n.chapterIndex) ? ` — Ch ${n.chapterIndex + 1}` : "";
        return `${bookTitle}${ch}`;
    }
    if (n.targetType === "upload" && n.uploadId != null) return `Upload #${n.uploadId}`;
    if (n.targetType === "grammar") {
        const c = n.concept ? n.concept : "Grammar";
        const s = n.subTopic ? ` — ${n.subTopic}` : "";
        return `${c}${s}`;
    }
    return "Note";
}

export default function NotesPanel() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [notes, setNotes] = useState([]);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [type, setType] = useState("all"); // all | book | upload | grammar
    const [tagFilter, setTagFilter] = useState("");
    const [editing, setEditing] = useState(null); // note object being edited via modal
    const [newOpen, setNewOpen] = useState(false);

    const PAGE_SIZE = 50;
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // search debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    // fetch notes (supports initial load, refresh, and append)
    async function fetchNotes({ append = false } = {}) {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setErr("");
        try {
            const params = new URLSearchParams();
            params.set("limit", String(PAGE_SIZE));
            if (debouncedQ) params.set("q", debouncedQ);
            else params.set("fields", "lite");
            if (tagFilter.trim()) params.set("tags", tagFilter.trim());
            if (type !== "all") params.set("type", type);
            if (append && nextCursor) params.set("cursor", nextCursor);

            const r = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to load notes");

            const incoming = j.data || [];
            if (append) {
                // de-dupe on append
                setNotes((prev) => {
                    const seen = new Set(prev.map((x) => x.id));
                    const add = incoming.filter((x) => !seen.has(x.id));
                    return [...prev, ...add];
                });
            } else {
                setNotes(incoming);
            }
            setNextCursor(j.nextCursor || null);

            if (!append && (incoming.length || debouncedQ || tagFilter)) {
                track("notes_loaded", {
                    ms_from_mount: Math.round(performance.now() - (window.__dashStart || 0)),
                    count: incoming.length,
                    q: debouncedQ ? 1 : 0,
                    tags: tagFilter ? 1 : 0,
                    type: type === "all" ? "all" : type,
                    lite: debouncedQ ? 0 : 1,
                });
            }
        } catch (e) {
            setErr(e.message || "Failed to load notes");
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }

    // initial + react to filters
    useEffect(() => {
        fetchNotes({ append: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // initial

    useEffect(() => {
        setNextCursor(null);
        fetchNotes({ append: false }); // re-fetch on changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, tagFilter, type]);

    // tag cloud
    const allTags = useMemo(() => {
        const m = new Map();
        for (const n of notes) {
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
            for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
        }
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    }, [notes]);

    // final list (server already filters by type, but keep client guard)
    const filtered = useMemo(() => {
        if (type === "all") return notes;
        return notes.filter((n) => n.targetType === type);
    }, [notes, type]);

    const hasActiveFilters = Boolean(debouncedQ || tagFilter || type !== "all");
    const canLoadMore = Boolean(nextCursor);

    // ---- Virtualizer ----
    const parentRef = useRef(null);
    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 120, // baseline; real size measured below
        overscan: 8,
        measureElement: (el) => el?.getBoundingClientRect?.().height || 120,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();

    // near-end prefetch (no bottom sentinel needed)
    useEffect(() => {
        if (!virtualItems.length) return;
        const last = virtualItems[virtualItems.length - 1];
        const nearEnd = last.index >= filtered.length - 5;
        if (nearEnd && canLoadMore && !loadingMore && !loading) {
            fetchNotes({ append: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [virtualItems, filtered.length, canLoadMore, loadingMore, loading]);

    function openAnchor(n) {
        if (n.targetType === "book" && Number.isInteger(n.bookIndex)) {
            const ch = Number.isInteger(n.chapterIndex) ? `&chapterIndex=${n.chapterIndex}` : "";
            window.location.href = `/readingpal?bookIndex=${n.bookIndex}${ch}`;
        } else if (n.targetType === "upload" && n.uploadId != null) {
            window.location.href = `/readingpal?upload=${n.uploadId}`;
        } else if (n.targetType === "grammar") {
            const search = new URLSearchParams();
            if (n.concept) search.set("concept", n.concept);
            if (n.subTopic) search.set("subTopic", n.subTopic);
            search.set("start", "1");
            window.location.href = `/grammar?${search.toString()}`;
        }
    }

    async function deleteNote(id) {
        if (!confirm("Delete this note?")) return;
        try {
            const r = await fetch(`/api/notes/${id}`, { method: "DELETE" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to delete");
            setNotes((prev) => prev.filter((n) => n.id !== id));
        } catch (e) {
            alert(e.message || "Failed to delete");
        }
    }

    return (
        <section className={styles.card}>
            <div className={styles.headerRow} style={{ marginBottom: 8 }}>
                <h3 className={styles.h4} style={{ margin: 0 }}>
                    📝 Notes
                </h3>
                <div className={styles.growRight}>
                    <input
                        className={styles.search}
                        placeholder="Search notes (text, anchor, or tags)…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        style={{ maxWidth: 260 }}
                        aria-label="Search notes"
                    />
                    <select
                        className={styles.btnSecondary}
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        aria-label="Filter by type"
                    >
                        <option value="all">All types</option>
                        <option value="book">Books</option>
                        <option value="upload">Uploads</option>
                        <option value="grammar">Grammar</option>
                    </select>
                    <button className={styles.btn} onClick={() => setNewOpen(true)}>
                        New note
                    </button>
                </div>
            </div>

            {/* Create new note via shared modal */}
            {newOpen && (
                <NotesModal
                    open={true}
                    onClose={() => setNewOpen(false)}
                    seed={{}}
                    typePicker={true}
                    initialType="grammar"
                    onSave={async ({ body, tags, color, isBookmark, targetType }) => {
                        try {
                            const r = await fetch("/api/notes", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    targetType: targetType || "grammar",
                                    anchorText: "",
                                    body,
                                    tags,
                                    color,
                                    isBookmark,
                                }),
                            });
                            const j = await r.json();
                            if (!j?.ok) throw new Error(j?.error || "Failed to create note");
                            setNotes((prev) => [j.data, ...prev]); // show at top
                            setNewOpen(false);
                        } catch (e) {
                            alert(e.message || "Failed to create note");
                        }
                    }}
                />
            )}

            {/* Tag quick filters */}
            {allTags.length > 0 && (
                <div className={styles.chips}>
                    {allTags.map(([t, count]) => (
                        <button
                            key={t}
                            className={styles.chip}
                            title={`${count} note${count === 1 ? "" : "s"}`}
                            onClick={() => setTagFilter((prev) => (prev === t ? "" : t))}
                            style={tagFilter === t ? { background: "#e9eefc", borderColor: "#c9d7fb", color: "#0b3b9f" } : undefined}
                        >
                            #{t}
                        </button>
                    ))}
                    {tagFilter && (
                        <button className={styles.btnSecondary} onClick={() => setTagFilter("")}>
                            Clear tag
                        </button>
                    )}
                </div>
            )}

            {/* Results */}
            {loading ? (
                <p className={styles.dim}>Loading…</p>
            ) : err ? (
                <p style={{ color: "#b91c1c" }}>{err}</p>
            ) : filtered.length === 0 ? (
                <>
                    {notes.length === 0 ? (
                        // Truly no notes exist yet
                        <div className={styles.empty}>
                            <p>No notes yet. Double-click in ReadingPal or press “N” in Grammar.</p>
                            <button className={styles.btn} onClick={() => setNewOpen(true)}>
                                Create your first note
                            </button>
                        </div>
                    ) : (
                        // Notes exist, but filters/search resulted in 0 matches
                        <div className={styles.empty}>
                            <p>
                                No results
                                {debouncedQ ? (
                                    <>
                                        {" "}
                                        for “<strong>{debouncedQ}</strong>”
                                    </>
                                ) : null}
                                {type !== "all" ? (
                                    <>
                                        {" "}
                                        in <strong>{type}</strong>
                                    </>
                                ) : null}
                                {tagFilter ? (
                                    <>
                                        {" "}
                                        with tag <strong>#{tagFilter}</strong>
                                    </>
                                ) : null}
                                .
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                                {debouncedQ ? (
                                    <button className={styles.btnSecondary} onClick={() => setQ("")} aria-label="Clear search">
                                        Clear search
                                    </button>
                                ) : null}
                                {tagFilter ? (
                                    <button className={styles.btnSecondary} onClick={() => setTagFilter("")} aria-label="Clear tag filter">
                                        Clear tag
                                    </button>
                                ) : null}
                                {hasActiveFilters ? (
                                    <button
                                        className={styles.btnSecondary}
                                        onClick={() => {
                                            setQ("");
                                            setTagFilter("");
                                            setType("all");
                                        }}
                                        aria-label="Reset all filters"
                                    >
                                        Reset filters
                                    </button>
                                ) : null}
                                <button className={styles.btn} onClick={() => setNewOpen(true)}>
                                    Create note
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className={styles.line1} style={{ marginBottom: 6 }}>
                        <span className={styles.dim}>
                            Showing <strong>{filtered.length}</strong>
                            {canLoadMore ? " (more available…)" : ""}
                            {debouncedQ ? ` for “${debouncedQ}”` : ""}
                        </span>
                    </div>

                    {/* Virtualized scroll area */}
                    <div
                        ref={parentRef}
                        role="list"
                        aria-label="Notes list"
                        style={{ height: "60vh", overflow: "auto", position: "relative" }}
                    >
                        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                            {virtualItems.map((vi) => {
                                const n = filtered[vi.index];
                                if (!n) return null;
                                const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
                                return (
                                    <div
                                        key={n.id}
                                        role="listitem"
                                        ref={rowVirtualizer.measureElement}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            transform: `translateY(${vi.start}px)`,
                                            willChange: "transform",
                                        }}
                                    >
                                        <div className={styles.noteItem}>
                                            <div className={styles.noteColor} style={{ background: n.color || "#e5e7eb" }} aria-hidden="true" />
                                            <div className={styles.noteBody}>
                                                <div className={styles.noteTopRow}>
                                                    <button className={styles.noteTitleBtn} onClick={() => openAnchor(n)} title="Open">
                                                        {titleForNote(n)}
                                                    </button>
                                                    <span className={styles.dim} style={{ marginLeft: "auto" }}>
                                                        {new Date(n.createdAt).toLocaleString()}
                                                    </span>
                                                </div>

                                                {n.anchorText && (
                                                    <div className={styles.noteAnchor} title="Anchor text">
                                                        “{debouncedQ ? highlight(n.anchorText, debouncedQ) : n.anchorText}”
                                                    </div>
                                                )}

                                                <div className={styles.noteText}>
                                                    {debouncedQ ? highlight(n.body || "", debouncedQ) : typeof n.body === "string" ? n.body : ""}
                                                </div>

                                                {tags.length > 0 && (
                                                    <div className={styles.tagRow}>
                                                        {tags.map((t) => (
                                                            <span key={t} className={styles.tagPill}>
                                                                {debouncedQ ? highlight(`#${t}`, debouncedQ) : `#${t}`}
                                                            </span>
                                                        ))}
                                                        {n.isBookmark && <span className={styles.tagPill}>bookmark</span>}
                                                    </div>
                                                )}

                                                <div className={styles.noteActions}>
                                                    <button className={styles.btn} onClick={() => setEditing(n)}>
                                                        Edit
                                                    </button>
                                                    <button className={styles.btnDanger} onClick={() => deleteNote(n.id)}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Load more fallback button */}
            <div className={styles.headerRow} style={{ justifyContent: "flex-end", marginTop: 8 }}>
                <button className={styles.btn} onClick={() => fetchNotes({ append: true })} disabled={!canLoadMore || loadingMore}>
                    {loadingMore ? "Loading…" : canLoadMore ? "Load more" : "No more results"}
                </button>
            </div>

            {/* Edit via shared modal */}
            {editing && (
                <NotesModal
                    open={true}
                    onClose={() => setEditing(null)}
                    seed={{
                        anchorText: editing.anchorText || "",
                        defaultTags: Array.isArray(editing.tagsJson) ? editing.tagsJson : [],
                        defaultColor: editing.color || undefined,
                        initialBody: editing.body || "",
                        isBookmark: !!editing.isBookmark,
                    }}
                    onSave={async ({ body, tags, color, isBookmark }) => {
                        try {
                            const r = await fetch(`/api/notes/${editing.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ body, tags, color, isBookmark }),
                            });
                            const j = await r.json();
                            if (!j?.ok) throw new Error(j?.error || "Failed to update");
                            setNotes((prev) => prev.map((x) => (x.id === editing.id ? j.data : x)));
                            setEditing(null);
                        } catch (e) {
                            alert(e.message || "Failed to update");
                        }
                    }}
                />
            )}
        </section>
    );

    // highlight helper
    function highlight(text, query) {
        if (!text || !query) return text;
        try {
            const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "ig");
            const parts = String(text).split(re);
            return parts.map((p, i) => (re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
        } catch {
            return text;
        }
    }
}
