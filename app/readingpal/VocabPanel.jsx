// app/readingpal/VocabPanel.jsx
"use client";
import styles from "./readingpal.module.css";

export default function VocabPanel({ vocab, onAdd, className = "" }) {
    const { word, lemma, pos, cefr, def, ex } = vocab || {};
    async function addAndNote() {
        try {
            const r = await fetch("/api/vocab/add", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ word, lemma }),
            });
            const j = await r.json();
            if (!j?.ok) return;
            const note = prompt(`Add a quick note for “${lemma || word}” (optional):`) || "";
            const example = prompt("Your own example sentence (optional):") || "";
            if (note || example) {
                await fetch("/api/vocab/note", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wordId: j.data.wordId, note, example }),
                });
            }
            alert("Saved to study.");
        } catch { /* ignore */ }
    }
    return (
        <aside className={`${styles.sidePanel} ${className}`}>
            <div className={styles.sideHeader}>
                <h3 className={styles.h4} style={{ margin: 0 }}>Vocabulary</h3>
            </div>
            {!word ? (
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
        </aside>
    );
}
