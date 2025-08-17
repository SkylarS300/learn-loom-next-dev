// app/dashboard/NotesPanel.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";
import books from "@/src/content/book-content.js";
import NotesModal from "../readingpal/NotesModal";

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
    const [limit, setLimit] = useState(50);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [type, setType] = useState("all"); // all | book | upload | grammar
    const [tagFilter, setTagFilter] = useState("");
    const [editing, setEditing] = useState(null); // note object being edited via modal
    const [newOpen, setNewOpen] = useState(false);

    // true debounce for search input
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    // fetch notes
    async function fetchNotes() {
        setLoading(true);
        setErr("");
        try {
            const params = new URLSearchParams();
            params.set("limit", String(limit));
            // Only request full fields (including `body`) when searching; otherwise keep payload light.
            if (debouncedQ) {
                params.set("q", debouncedQ);
                // omit fields=lite to include `body`
            } else {
                params.set("fields", "lite");
            }
            if (tagFilter.trim()) params.set("tags", tagFilter.trim());
            const r = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to load notes");
            setNotes(j.data || []);
        } catch (e) {
            setErr(e.message || "Failed to load notes");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        fetchNotes();
    }, []); // initial
    useEffect(() => {
        fetchNotes(); /* debounced via debouncedQ */
    }, [limit, debouncedQ, tagFilter]);

    // tag cloud
    const allTags = useMemo(() => {
        const m = new Map();
        for (const n of notes) {
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
            for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
        }
        return Array.from(m.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
    }, [notes]);

    // filter by type
    const filtered = useMemo(() => {
        if (type === "all") return notes;
        return notes.filter((n) => n.targetType === type);
    }, [notes, type]);

    // any active filters/search?
    const hasActiveFilters = Boolean(debouncedQ || tagFilter || (type !== "all"));


    // simple highlighter for query matches
    function highlight(text, query) {
        if (!text || !query) return text;
        try {
            const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
            const parts = String(text).split(re);
            return parts.map((p, i) => (re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
        } catch {
            return text;
        }
    }

    // `Load more` availability heuristic: if API returned `limit` items, assume there may be more.
    const canLoadMore = filtered.length === limit;

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

            {/* Create new note via ReadingPal modal */}
            {newOpen && (
                <NotesModal
                    open={true}
                    onClose={() => setNewOpen(false)}
                    seed={{}} // no anchor/defaults for dashboard-created notes
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
                            style={
                                tagFilter === t ? { background: "#e9eefc", borderColor: "#c9d7fb", color: "#0b3b9f" } : undefined
                            }
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
                <div className={styles.empty}>
                    <p>No notes yet. Double-click in ReadingPal or press “N” in Grammar.</p>
                    <button className={styles.btn} onClick={() => setNewOpen(true)}>
                        Create your first note
                    </button>
                </div>

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
                                {debouncedQ ? <> for “<strong>{debouncedQ}</strong>”</> : null}
                                {type !== "all" ? <> in <strong>{type}</strong></> : null}
                                {tagFilter ? <> with tag <strong>#{tagFilter}</strong></> : null}
                                .
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                                {debouncedQ ? (
                                    <button
                                        className={styles.btnSecondary}
                                        onClick={() => setQ("")}
                                        aria-label="Clear search"
                                    >
                                        Clear search
                                    </button>
                                ) : null}
                                {tagFilter ? (
                                    <button
                                        className={styles.btnSecondary}
                                        onClick={() => setTagFilter("")}
                                        aria-label="Clear tag filter"
                                    >
                                        Clear tag
                                    </button>
                                ) : null}
                                {type !== "all" || hasActiveFilters ? (
                                    <button
                                        className={styles.btnSecondary}
                                        onClick={() => { setQ(""); setTagFilter(""); setType("all"); setLimit(50); }}
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
                    <ul className={styles.noteList} role="list">
                        {filtered.slice(0, limit).map((n) => {
                            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
                            return (
                                <li key={n.id} className={styles.noteItem} role="listitem">
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
                                                “{highlight(n.anchorText, debouncedQ)}”
                                            </div>
                                        )}

                                        <div className={styles.noteText}>{debouncedQ ? highlight(n.body, debouncedQ) : n.body}</div>

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
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {/* Load more */}
            <div className={styles.headerRow} style={{ justifyContent: "flex-end", marginTop: 8 }}>
                <button
                    className={styles.btnSecondary}
                    onClick={() => setLimit((v) => Math.max(10, v - 25))}
                    disabled={limit <= 25}
                >
                    Show fewer
                </button>
                <button className={styles.btn} onClick={() => setLimit((v) => v + 50)} disabled={!canLoadMore}>
                    {canLoadMore ? "Load more" : "No more results"}
                </button>
            </div>

            {/* Edit via shared ReadingPal modal */}
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
}
