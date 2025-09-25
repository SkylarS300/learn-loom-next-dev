"use client";

import { useEffect, useRef } from "react";
import styles from "./readingpal.module.css";

export default function SelectBookModal({ open, onClose }) {
    const firstRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        firstRef.current?.focus();
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="select-book-title"
            className={styles.modalBackdrop}
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div className={styles.modalCard}>
                <div className={styles.modalHeader}>
                    <h3 id="select-book-title" className={styles.modalTitle}>Select a book to start</h3>
                    <button className={styles.modalCloseX} aria-label="Close" onClick={onClose}>✖</button>
                </div>
                <p className={styles.dim} style={{ marginTop: 0 }}>
                    Choose a book from your library, or open an uploaded text.
                </p>
                <div className={styles.modalActions}>
                    <a
                        ref={firstRef}
                        href="/library"
                        className={styles.secondaryBtn}
                    >
                        📚 Go to Library
                    </a>
                    <a
                        href="/uploads"
                        className={styles.secondaryBtn}
                    >
                        📤 View Uploads
                    </a>
                    <button onClick={onClose} className={styles.primaryBtn}>
                        Okay
                    </button>
                </div>
            </div>
        </div>
    );
}
