// app/readingpal/NotesSidePanel.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import styles from "./readingpal.module.css";
import NotesModal from "./NotesModal";

export default function NotesSidePanel({
    bookIndex = null,
    chapterIndex = null,
    uploadId = null,
    onJump = () => { },
    onChanged = () => { },
}) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [notes, setNotes] = useState([]);
    const [q, setQ] = useState("");
    const [tagFilter, setTagFilter] = useState("");
    const [editing, setEditing] = useState(null);

    // fetch full bodies for edit quality (chapter-level volume is small)
    async function fetchNotes() {
        setLoading(true); setErr("");
        try {
            const params = new URLSearchParams();
            params.set("limit", "200");
            params.set("scope", "current");
            if (uploadId != null) params.set("uploadId", String(uploadId));
            if (bookIndex != null) params.set("bookIndex", String(bookIndex));
            if (chapterIndex != null) params.set("chapterIndex", String(chapterIndex));
            // omit fields=lite so `body` is returned
            const r = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed");
            setNotes(j.data || []);
            onChanged(j.data || []);
        } catch (e) {
            setErr(e.message || "Failed to load notes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchNotes(); /* eslint-disable-next-line */ }, [bookIndex, chapterIndex, uploadId]);

    const tagsAll = useMemo(() => {
        const m = new Map();
        for (const n of notes) {
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
            for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
        }
        return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16);
    }, [notes]);

    const filtered = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return notes.filter(n => {
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
            const tagOK = tagFilter ? tags.includes(tagFilter) : true;
            if (!ql) return tagOK;
            const inBody = n.body?.toLowerCase?.().includes(ql);
            const inAnchor = n.anchorText?.toLowerCase?.().includes(ql);
            const inTags = tags.some(t => String(t).toLowerCase().includes(ql));
            return tagOK && (inBody || inAnchor || inTags);
        });
    }, [notes, q, tagFilter]);

    async function remove(id) {
        if (!confirm("Delete this note?")) return;
        try {
            const r = await fetch(`/api/notes/${id}`, { method: "DELETE" });
            const j = await r.json();
            if (!j?.ok) throw new Error(j?.error || "Failed to delete");
            const next = notes.filter(n => n.id !== id);
            setNotes(next); onChanged(next);
        } catch (e) {
            alert(e.message || "Failed to delete");
        }
    }

    // --- virtualization ---
    const parentRef = useRef(null);
    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 110,
        overscan: 6,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
        <aside className={styles.sidePanel}>
            <div className={styles.sideHeader}>
                <h3 className={styles.h4} style={{ margin: 0 }}>Notes in this {uploadId ? "upload" : "chapter"}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                    {tagFilter && (
                        <button className={styles.secondaryBtn} onClick={() => setTagFilter("")} title="Clear tag">Clear tag</button>
                    )}
                    <button className={styles.secondaryBtn} onClick={fetchNotes} title="Refresh">Refresh</button>
                </div>
            </div>

            <input
                className={styles.searchInput}
                placeholder="Search body / anchor / tags…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search notes"
            />

            {!!tagsAll.length && (
                <div className={styles.chipsRow}>
                    {tagsAll.map(([t, c]) => (
                        <button
                            key={t}
                            className={styles.chip}
                            onClick={() => setTagFilter(prev => prev === t ? "" : t)}
                            title={`${c} note${c === 1 ? "" : "s"}`}
                            style={tagFilter === t ? { background: "#e9eefc", borderColor: "#c9d7fb", color: "#0b3b9f" } : undefined}
                        >
                            #{t}
                        </button>
                    ))}
                </div>
            )}

            {loading ? <p className={styles.dim}>Loading…</p> :
                err ? <p style={{ color: "#b91c1c" }}>{err}</p> :
                    filtered.length === 0 ? (
                        <p className={styles.dim} style={{ marginTop: 8 }}>
                            {notes.length ? "No matches." : "No notes in this location yet."}
                        </p>
                    ) : (
                        <div
                            ref={parentRef}
                            className={styles.sideScroll}
                            role="list"
                            aria-label="Notes list"
                            style={{ position: "relative" }}
                        >
                            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                                {virtualItems.map(vi => {
                                    const n = filtered[vi.index];
                                    if (!n) return null;
                                    const tags = Array.isArray(n.tagsJson) ? n.tagsJson : [];
                                    return (
                                        <div
                                            key={n.id}
                                            role="listitem"
                                            ref={rowVirtualizer.measureElement}
                                            className={styles.sideNoteItem}
                                            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
                                        >
                                            <div className={styles.noteColor} style={{ background: n.color || "#e5e7eb" }} aria-hidden="true" />
                                            <div className={styles.noteBody}>
                                                <div className={styles.noteTopRow}>
                                                    <button
                                                        className={styles.linkBtn}
                                                        onClick={() => Number.isInteger(n.sentenceIndex) && onJump(n.sentenceIndex)}
                                                        title={Number.isInteger(n.sentenceIndex) ? `Jump to sentence ${n.sentenceIndex + 1}` : "Jump"}
                                                    >
                                                        {n.anchorText ? n.anchorText.slice(0, 80) : "(no anchor)"}
                                                    </button>
                                                    <span className={styles.dim} style={{ marginLeft: "auto" }}>
                                                        {new Date(n.createdAt).toLocaleString()}
                                                    </span>
                                                </div>

                                                {!!n.body && (
                                                    <div className={styles.noteText} style={{ marginTop: 4 }}>
                                                        {n.body.length > 160 ? n.body.slice(0, 160) + "…" : n.body}
                                                    </div>
                                                )}

                                                {!!tags.length && (
                                                    <div className={styles.tagRow} style={{ marginTop: 4 }}>
                                                        {tags.map(t => <span key={t} className={styles.tagPill}>#{t}</span>)}
                                                        {n.isBookmark && <span className={styles.tagPill}>bookmark</span>}
                                                    </div>
                                                )}

                                                <div className={styles.noteActions}>
                                                    <button className={styles.secondaryBtn} onClick={() => setEditing(n)}>Edit</button>
                                                    <button className={styles.secondaryBtn} onClick={() => Number.isInteger(n.sentenceIndex) && onJump(n.sentenceIndex)}>Jump</button>
                                                    <button className={styles.btnDanger} onClick={() => remove(n.id)}>Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                            const next = notes.map(x => x.id === editing.id ? j.data : x);
                            setNotes(next); onChanged(next);
                            setEditing(null);
                        } catch (e) {
                            alert(e.message || "Failed to update");
                        }
                    }}
                />
            )}
        </aside>
    );
}
