// app/readingpal/NotesModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./readingpal.module.css";

const PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#FDE047", "#F97316", "#EC4899", "#8B5CF6"];

export default function NotesModal({ open, seed, onClose, onSave }) {
    const [body, setBody] = useState("");
    const [tagsStr, setTagsStr] = useState("");
    const [color, setColor] = useState(PALETTE[0]);
    const [isBookmark, setIsBookmark] = useState(false);

    // seed: { anchorText, defaultTags, defaultColor, isBookmark }
    useEffect(() => {
        if (!open) return;
        setBody(seed?.anchorText ? `${seed.anchorText}\n\n` : "");
        setTagsStr((seed?.defaultTags || []).join(", "));
        setColor(seed?.defaultColor || PALETTE[0]);
        setIsBookmark(!!seed?.isBookmark);
    }, [open, seed]);

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
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Add note">
            <div className={styles.modalCard}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Add a note</h3>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✖</button>
                </div>

                {seed?.anchorText && (
                    <div className={styles.anchorBox} title="Selected text">
                        {seed.anchorText}
                    </div>
                )}

                <label className={styles.label}>
                    <span>Note <span className={styles.dim}>(max 2000 chars)</span></span>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your note…"
                    />
                    <div className={over ? styles.countOver : styles.count}>{charCount}/2000</div>
                </label>

                <label className={styles.label}>
                    <span>Tags <span className={styles.dim}>(comma separated)</span></span>
                    <input
                        className={styles.input}
                        value={tagsStr}
                        onChange={(e) => setTagsStr(e.target.value)}
                        placeholder="vocab, review, chapter-3"
                    />
                    {parsedTags.length > 0 && (
                        <div className={styles.tagRow}>
                            {parsedTags.map((t) => (
                                <span key={t} className={styles.tagPill}>{t}</span>
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
                    <input
                        type="checkbox"
                        checked={isBookmark}
                        onChange={(e) => setIsBookmark(e.target.checked)}
                    />
                    <span>Also mark as a bookmark</span>
                </label>

                <div className={styles.modalActions}>
                    <button className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => onSave({ body, tags: parsedTags, color, isBookmark })}
                        disabled={!body.trim() || over}
                    >
                        Save note
                    </button>
                </div>
            </div>
        </div>
    );
}
