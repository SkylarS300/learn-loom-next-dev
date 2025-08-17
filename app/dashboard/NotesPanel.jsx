// app/dashboard/NotesPanel.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";
import books from "@/src/content/book-content.js";

function titleForNote(n) {
    if (n.targetType === "book" && Number.isInteger(n.bookIndex)) {
        const b = books?.[n.bookIndex];
        const bookTitle = b?.title ? `${b.title}` : `Book #${n.bookIndex}`;
        const ch = Number.isInteger(n.chapterIndex) ? ` — Ch ${n.chapterIndex + 1}` : "";
        return `${bookTitle}${ch}`;
    }
    if (n.targetType === "upload" && n.uploadId != null) {
        return `Upload #${n.uploadId}`;
    }
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
    const [type, setType] = useState("all"); // all | book | upload | grammar
    const [tagFilter, setTagFilter] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [draftBody, setDraftBody] = useState("");
    const [draftTags, setDraftTags] = useState("");
    const [draftColor, setDraftColor] = useState("");
    const [saving, setSaving] = useState(false);

    // fetch notes whenever limit / q / tagFilter change
    useEffect(() => {
        let dead = false;
        (async () => {
            setLoading(true);
            setErr("");
            try {
                const params = new URLSearchParams();
                params.set("limit", String(limit));
                if (q.trim()) params.set("q", q.trim());
                if (tagFilter.trim()) params.set("tags", tagFilter.trim());
                const r = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
                const j = await r.json();
                if (!dead) {
                    if (j?.ok) setNotes(j.data || []);
                    else setErr(j?.error || "Failed to load notes");
                }
            } catch {
                if (!dead) setErr("Failed to load notes");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, [limit, q, tagFilter]);

    // derive tag cloud from fetched notes
    const allTags = useMemo(() => {
        const m = new Map();
        for (const n of notes) {
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
            for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
        }
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    }, [notes]);

    // filter by type locally
    const filtered = useMemo(() => {
        if (type === "all") return notes;
        return notes.filter((n) => n.targetType === type);
    }, [notes, type]);

    function openEdit(n) {
        setEditingId(n.id);
        setDraftBody(n.body || "");
        const tags = Array.isArray(n.tagsJson) ? n.tagsJson.join(", ") : "";
        setDraftTags(tags);
        setDraftColor(n.color || "");
    }

    async function saveEdit() {
        if (!editingId) return;
        setSaving(true);
        try {
            const tags = draftTags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 10);
            const r = await fetch(`/api/notes/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: draftBody, tags, color: draftColor }),
            });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to save");
            // refresh list in-place
            setNotes((prev) => prev.map((n) => (n.id === editingId ? j.data : n)));
            setEditingId(null);
        } catch (e) {
            alert(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    async function del(id) {
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

    return (
        <section className={styles.card}>
            <div className={styles.headerRow} style={{ marginBottom: 8 }}>
                <h3 className={styles.h4} style={{ margin: 0 }}>📝 Notes</h3>
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
                </div>
            </div>

            {/* Tag quick filters */}
            {allTags.length > 0 && (
                <div className={styles.chips} style={{ marginTop: 4 }}>
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
                        <button className={styles.btnSecondary} onClick={() => setTagFilter("")}>Clear tag</button>
                    )}
                </div>
            )}

            {/* Results */}
            {loading ? (
                <p className={styles.dim}>Loading…</p>
            ) : err ? (
                <p style={{ color: "#b91c1c" }}>{err}</p>
            ) : filtered.length === 0 ? (
                <p className={styles.dim}>No notes yet. Double-click in ReadingPal or press “N." You can also add notes in Grammar Quizzes.</p>
            ) : (
                <ul className={styles.noteList} role="list">
                    {filtered.map((n) => {
                        const isEditing = editingId === n.id;
                        const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
                        return (
                            <li key={n.id} className={styles.noteItem} role="listitem">
                                <div className={styles.noteColor} style={{ background: n.color || "#e5e7eb" }} />
                                <div className={styles.noteBody}>
                                    <div className={styles.noteTopRow}>
                                        <button className={styles.noteTitleBtn} onClick={() => openAnchor(n)} title="Open">
                                            {titleForNote(n)}
                                        </button>
                                        <span className={styles.dim}>
                                            {new Date(n.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    {!isEditing ? (
                                        <>
                                            {n.anchorText && (
                                                <div className={styles.noteAnchor} title="Anchor text">
                                                    “{n.anchorText}”
                                                </div>
                                            )}
                                            <div className={styles.noteText}>{n.body}</div>
                                            {tags.length > 0 && (
                                                <div className={styles.tagRow}>
                                                    {tags.map((t) => <span key={t} className={styles.tagPill}>#{t}</span>)}
                                                    {n.isBookmark && <span className={styles.tagPill}>bookmark</span>}
                                                </div>
                                            )}
                                            <div className={styles.noteActions}>
                                                <button className={styles.btn} onClick={() => openEdit(n)}>Edit</button>
                                                <button className={styles.btnDanger} onClick={() => del(n.id)}>Delete</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className={styles.editWrap}>
                                            <textarea
                                                className={styles.textarea}
                                                rows={4}
                                                value={draftBody}
                                                onChange={(e) => setDraftBody(e.target.value)}
                                            />
                                            <div className={styles.editRow}>
                                                <input
                                                    className={styles.input}
                                                    style={{ maxWidth: 260 }}
                                                    value={draftTags}
                                                    onChange={(e) => setDraftTags(e.target.value)}
                                                    placeholder="tags, comma,separated"
                                                />
                                                <input
                                                    className={styles.input}
                                                    style={{ width: 120 }}
                                                    value={draftColor}
                                                    onChange={(e) => setDraftColor(e.target.value)}
                                                    placeholder="#F59E0B"
                                                />
                                                <div className={styles.growRight}>
                                                    <button className={styles.btnSecondary} onClick={() => setEditingId(null)}>Cancel</button>
                                                    <button className={styles.btn} onClick={saveEdit} disabled={saving}>
                                                        {saving ? "Saving…" : "Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Load more */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button className={styles.btnSecondary} onClick={() => setLimit((v) => Math.max(10, v - 25))} disabled={limit <= 25}>Show fewer</button>
                <button className={styles.btn} onClick={() => setLimit((v) => v + 50)}>Load more</button>
            </div>
        </section>
    );
}
