// app/components/NotesModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
// NOTE: now that this lives in /components, import the ReadingPal CSS module via a relative path:
import styles from "../readingpal/readingpal.module.css";

const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#FDE047", "#F97316", "#EC4899", "#8B5CF6"];

// Props:
// - open: boolean
// - seed: { anchorText?, defaultTags?, defaultColor?, isBookmark?, initialBody? }
// - onClose: () => void
// - onSave: ({ body, tags, color, isBookmark, targetType? }) => void
// - typePicker?: boolean  (when true, show a type <select> at top)
// - initialType?: 'book'|'upload'|'grammar'
export default function NotesModal({ open, seed, onClose, onSave, typePicker = false, initialType = "grammar" }) {
    const [body, setBody] = useState("");
    const [tagsStr, setTagsStr] = useState("");
    const [color, setColor] = useState(PALETTE[0]);
    const [isBookmark, setIsBookmark] = useState(false);
    const [targetType, setTargetType] = useState(initialType);

    // seed: { anchorText, defaultTags, defaultColor, isBookmark, initialBody }
    useEffect(() => {
        if (!open) return;
        setBody(typeof seed?.initialBody === "string" ? seed.initialBody : (seed?.anchorText ? `${seed.anchorText}\n\n` : ""));
        setTagsStr((seed?.defaultTags || []).join(", "));
        setColor(seed?.defaultColor || PALETTE[0]);
        setIsBookmark(!!seed?.isBookmark);
        setTargetType(initialType);
    }, [open, seed, initialType]);

    const charCount = body.length;
    const over = charCount > 2000;

    const parsedTags = useMemo(
        () =>
            tagsStr
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 10),
        [tagsStr]
    );

    if (!open) return null;

    return (
        <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Add note"
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose?.();
            }}
        >
            <div className={styles.modalCard}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Add a note</h3>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        ✖
                    </button>
                </div>

                {typePicker && (
                    <label className={styles.label}>
                        <span>Type</span>
                        <select
                            className={styles.input}
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value)}
                            aria-label="Note type"
                        >
                            <option value="grammar">Grammar</option>
                            <option value="book">Book</option>
                            <option value="upload">Upload</option>
                        </select>
                    </label>
                )}

                {seed?.anchorText && (
                    <div className={styles.anchorBox} title="Selected text">
                        {seed.anchorText}
                    </div>
                )}

                <label className={styles.label}>
                    <span>
                        Note <span className={styles.dim}>(max 2000 chars)</span>
                    </span>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your note…"
                        autoFocus
                    />
                    <div className={over ? styles.countOver : styles.count}>{charCount}/2000</div>
                </label>

                <label className={styles.label}>
                    <span>
                        Tags <span className={styles.dim}>(comma separated)</span>
                    </span>
                    <input
                        className={styles.input}
                        value={tagsStr}
                        onChange={(e) => setTagsStr(e.target.value)}
                        placeholder="vocab, review, chapter-3"
                    />
                    {parsedTags.length > 0 && (
                        <div className={styles.tagRow}>
                            {parsedTags.map((t) => (
                                <span key={t} className={styles.tagPill}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </label>

                <div className={styles.colorPickerRow}>
                    <span className={styles.labelText}>Color</span>
                    <div className={styles.colorRow}>
                        {PALETTE.map((c) => (
                            <button
                                key={c}
                                className={styles.swatchBtn}
                                style={{ backgroundColor: c, outline: c === color ? "2px solid #111827" : "none" }}
                                onClick={() => setColor(c)}
                                aria-label={`Choose color ${c}`}
                            />
                        ))}
                    </div>
                </div>

                <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={isBookmark} onChange={(e) => setIsBookmark(e.target.checked)} />
                    <span>Also mark as a bookmark</span>
                </label>

                <div className={styles.modalActions}>
                    <button className={styles.secondaryBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => onSave({ body, tags: parsedTags, color, isBookmark, targetType })}
                        disabled={!body.trim() || over}
                    >
                        Save note
                    </button>
                </div>
            </div>
        </div>
    );
}
