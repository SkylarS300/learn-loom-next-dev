// app/readingpal/VocabPanel.jsx
"use client";
import styles from "./readingpal.module.css";

export default function VocabPanel({ vocab, onAdd, className = "" }) {
    const { word, lemma, pos, cefr, def, ex } = vocab || {};
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
                        <a className={styles.secondaryBtn} href={`https://youglish.com/search/${encodeURIComponent(lemma || word)}/english`} target="_blank" rel="noreferrer">Hear in context</a>
                    </div>
                </>
            )}
        </aside>
    );
}
