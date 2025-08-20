"use client";

import { useEffect, useMemo, useState } from "react";

export default function MyNotesCard() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [sort, setSort] = useState("newest"); // newest | byBook | byTag

    useEffect(() => {
        let dead = false;
        (async () => {
            try {
                // Keep it simple: client-side search over a larger page
                const r = await fetch("/api/notes?limit=200&fields=lite", { cache: "no-store" });
                const j = await r.json().catch(() => ({}));
                if (!dead) {
                    if (!j?.ok) throw new Error(j?.error || "Failed to load notes");
                    setRows(j.data || []);
                }
            } catch (e) {
                if (!dead) setErr(e.message || "Failed to load notes");
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const arr = (rows || []).filter(n => {
            if (!needle) return true;
            const tags = Array.isArray(n.tagsJson) ? n.tagsJson : (Array.isArray(n.tags) ? n.tags : []);
            const hay =
                `${n.body || ""} ${n.anchorText || ""} ${(tags || []).join(" ")}`.toLowerCase();
            return hay.includes(needle);
        });

        if (sort === "byBook") {
            return [...arr].sort((a, b) => (a.bookIndex ?? 1e9) - (b.bookIndex ?? 1e9));
        }
        if (sort === "byTag") {
            const tagKey = (n) => {
                const tags = Array.isArray(n.tagsJson) ? n.tagsJson : (Array.isArray(n.tags) ? n.tags : []);
                return (tags[0] || "~").toString().toLowerCase();
            };
            return [...arr].sort((a, b) => tagKey(a).localeCompare(tagKey(b)));
        }
        // newest
        return [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [rows, q, sort]);

    const linkFor = (n) => {
        if (n.targetType === "book" && Number.isFinite(n.bookIndex)) {
            const c = Number.isFinite(n.chapterIndex) ? `&chapterIndex=${n.chapterIndex}` : "";
            return `/readingpal?bookIndex=${n.bookIndex}${c}&resume=1`;
        }
        if (n.targetType === "upload" && n.uploadId) {
            return `/uploads/${n.uploadId}`;
        }
        if (n.targetType === "grammar" && n.concept && n.subTopic) {
            return `/grammar?concept=${encodeURIComponent(n.concept)}&subTopic=${encodeURIComponent(n.subTopic)}&start=1`;
        }
        return null;
    };

    return (
        <section style={card}>
            <div style={row}>
                <h3 style={{ margin: 0 }}>🗒️ My Notes</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <input
                        placeholder="Search body / anchor / tags…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        aria-label="Search notes"
                        style={input}
                    />
                    <select value={sort} onChange={(e) => setSort(e.target.value)} style={input}>
                        <option value="newest">Newest</option>
                        <option value="byBook">By book</option>
                        <option value="byTag">By tag</option>
                    </select>
                </div>
            </div>

            {loading && <p style={{ color: "#666" }}>Loading…</p>}
            {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
            {!loading && !err && filtered.length === 0 && (
                <p style={{ color: "#666" }}>No notes yet.</p>
            )}

            {!!filtered.length && (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {filtered.map((n) => {
                        const href = linkFor(n);
                        const tags = Array.isArray(n.tagsJson) ? n.tagsJson : (Array.isArray(n.tags) ? n.tags : []);
                        const meta =
                            n.targetType === "book"
                                ? `Book ${Number.isFinite(n.bookIndex) ? n.bookIndex + 1 : "—"}`
                                : n.targetType === "upload"
                                    ? `Upload ${n.uploadId}`
                                    : n.targetType === "grammar"
                                        ? `Grammar — ${n.concept} / ${n.subTopic}`
                                        : n.targetType || "—";
                        return (
                            <div key={n.id} style={rowItem}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {n.anchorText || "(no anchor)"}
                                    </div>
                                    <div style={{ color: "#666", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {n.body}
                                    </div>
                                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                                        {meta} • {new Date(n.createdAt).toLocaleString()}
                                        {!!tags?.length && (
                                            <>
                                                {" "}•{" "}
                                                {tags.slice(0, 4).map((t) => (
                                                    <span key={t} style={pill}>#{t}</span>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {href ? (
                                    <a href={href} style={btn}>Open</a>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

/* styles */
const card = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
const row = { display: "flex", alignItems: "center", gap: 8 };
const input = { padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 };
const rowItem = { display: "flex", gap: 12, alignItems: "center", border: "1px solid #eee", borderRadius: 8, padding: 10 };
const btn = { background: "#e9eefc", color: "#0b3b9f", border: "1px solid #c9d7fb", padding: "6px 10px", borderRadius: 8, textDecoration: "none" };
const pill = { border: "1px solid #d9e3ff", background: "#f1f5ff", color: "#0b3b9f", borderRadius: 999, padding: "0px 6px", marginRight: 6 };
