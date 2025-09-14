"use client";
import { useEffect, useState } from "react";
import styles from "./readingpal.module.css";

/* Minimal toast helper (non-blocking) */
function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
        background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: "8px",
        zIndex: "9999", fontSize: "13px", opacity: "0.95",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)",
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

/* Reusable modal that matches ReadingPal styling */
function Modal({ open, title, children, onClose }) {
    useEffect(() => {
        if (!open) return;
        function onKey(e) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button className={styles.modalCloseX} onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className={styles.modalBody}>{children}</div>
            </div>
        </div>
    );
}

export default function VocabPanel({ vocab, onAdd, className = "" }) {
    const { word, lemma, pos, cefr, def, ex } = vocab || {};
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState("");
    const [example, setExample] = useState("");
    const [saving, setSaving] = useState(false);

    async function addAndNote() {
        if (!word && !lemma) return;
        try {
            const r = await fetch("/api/vocab/add", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ word, lemma }),
            });
            const j = await r.json();
            if (!j?.ok) {
                toast("⚠️ Could not add word");
                return;
            }
            // open styled modal prefilled with nothing
            setNote(""); setExample(""); setNoteOpen(true);
            // store wordId on the modal instance via closure:
            VocabPanel._lastWordId = j.data?.wordId;
        } catch {
            toast("⚠️ Network error");
        }
    }

    async function saveNote() {
        if (!VocabPanel._lastWordId) { setNoteOpen(false); return; }
        setSaving(true);
        try {
            const r = await fetch("/api/vocab/note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wordId: VocabPanel._lastWordId,
                    note: (note || "").slice(0, 2000),
                    example: (example || "").slice(0, 500),
                }),
            });
            if (!r.ok) throw new Error("note");
            toast("✅ Saved to study");
            setNoteOpen(false);
        } catch {
            toast("⚠️ Could not save note");
        } finally {
            setSaving(false);
        }
    }

    return (
        <aside className={`${styles.sidePanel} ${className}`}>
            <div className={styles.sideHeader}>
                <h3 className={styles.h4} style={{ margin: 0 }}>Vocabulary</h3>
            </div>
            +      {!word ? (
                <p className={styles.dim} style={{ marginTop: 4 }}>Select a word to see details.</p>
            ) : (
                <>
                    <div className={styles.vocabHead}>
                        <div className={styles.vocabLemma}>{lemma || word}</div>
                        <div className={styles.vocabMeta}>
                            {pos ? `${pos} · ` : ""}{cefr || "—"}
                        </div>
                    </div>
                    {def && <div className={styles.vocabDef}>{def}</div>}
                    {ex && <div className={styles.dim} style={{ marginTop: 6 }}><em>{ex}</em></div>}
                    <div className={styles.vocabBtnRow}>
                        <button className={styles.primaryBtn} onClick={onAdd}>Add to study</button>
                        <button className={styles.secondaryBtn} onClick={addAndNote}>✏️ Add + note</button>
                        <a className={styles.secondaryBtn} href={`https://youglish.com/search/${encodeURIComponent(lemma || word)}/english`} target="_blank" rel="noreferrer">Hear in context</a>
                    </div>
                </>
            )}

            {/* Styled Add+Note modal */}
            <Modal open={noteOpen} title={`Word details — ${lemma || word}`} onClose={() => setNoteOpen(false)}>
                <div className={styles.anchorBox} style={{ marginBottom: 8 }}>
                    <strong>{lemma || word}</strong>{pos ? ` · ${pos}` : ""} {cefr ? ` · ${cefr}` : ""}
                    {def ? <div className={styles.dim} style={{ marginTop: 4 }}>{def}</div> : null}
                </div>
                <label className={styles.label}>
                    <span className={styles.labelText}>Personal note</span>
                    <textarea
                        className={styles.textarea}
                        rows={4}
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                    />
                    <div className={note.length > 2000 ? styles.countOver : styles.count}>
                        {note.length}/2000
                    </div>
                </label>
                <label className={styles.label}>
                    <span className={styles.labelText}>Your example sentence</span>
                    <input
                        className={styles.input}
                        type="text"
                        value={example}
                        onChange={(e) => setExample(e.target.value.slice(0, 500))}
                    />
                    <div className={example.length > 500 ? styles.countOver : styles.count}>
                        {example.length}/500
                    </div>
                </label>
                <div className={styles.modalActions}>
                    <button className={styles.secondaryBtn} onClick={() => setNoteOpen(false)} disabled={saving}>Cancel</button>
                    <button className={styles.primaryBtn} onClick={saveNote} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                </div>
            </Modal>
        </aside>
    );
}