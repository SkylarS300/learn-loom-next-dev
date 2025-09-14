// app/readingpal/PronouncePractice.jsx
"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./readingpal.module.css";
import { scorePronunciation } from "@/src/speech/scorePronunciation";

export default function PronouncePractice({ open, text, onClose }) {
    const [recording, setRecording] = useState(false);
    const [score, setScore] = useState(null);
    const [msg, setMsg] = useState("");
    const meterRef = useRef(null);
    const mediaRef = useRef(null);
    const recRef = useRef(null);
    const recogRef = useRef(null);
    const lastTranscriptRef = useRef("");

    useEffect(() => { if (!open) { setRecording(false); setScore(null); setMsg(""); } }, [open]);

    useEffect(() => {
        if (open && text) {
            try {
                const u = new SpeechSynthesisUtterance(text);
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            } catch { }
        }
    }, [open, text]);

    if (!open) return null;

    async function start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRef.current = stream;
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            const tick = () => {
                analyser.getByteTimeDomainData(data);
                const variance = data.reduce((a, v) => a + Math.abs(v - 128), 0) / data.length;
                if (meterRef.current) meterRef.current.style.width = Math.min(100, Math.round(variance / 1.2)) + "%";
                if (recording) requestAnimationFrame(tick);
            };
            setRecording(true);
            tick();
            // minimal “recording” – we don’t need audio data for local scoring
            setMsg("Speak the word clearly…");

            // Start Web Speech recognition if available
            try {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (SR) {
                    const recog = new SR();
                    recog.lang = "en-US";
                    recog.interimResults = false;
                    recog.maxAlternatives = 1;
                    recog.onresult = (e) => {
                        const t = e.results?.[0]?.[0]?.transcript || "";
                        lastTranscriptRef.current = t;
                    };
                    recog.onerror = () => { /* ignore; we’ll still stop and score */ };
                    recogRef.current = recog;
                    recog.start();
                } else {
                    lastTranscriptRef.current = "";
                }
            } catch { /* no-op */ }
            setTimeout(stop, 2000);
        } catch {
            setMsg("Microphone permission denied.");
        }
    }
    function stop() {
        setRecording(false);
        mediaRef.current?.getTracks()?.forEach(t => t.stop());
        mediaRef.current = null;
        try { recogRef.current?.stop?.(); } catch { }
        const attempt = lastTranscriptRef.current || "";
        const s = scorePronunciation(text || "", attempt);
        setScore(s);
        setMsg(attempt ? s.tips : "Couldn’t capture speech—try again, or type it.");
    }

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalCard} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h4 className={styles.h4} style={{ margin: 0 }}>Pronunciation practice</h4>
                    <button className={styles.closeBtn} onClick={onClose}>✖</button>
                </div>
                <p style={{ marginTop: 0 }}><strong>Target:</strong> {text || "—"}</p>
                <div className={styles.meter}><div ref={meterRef} className={styles.meterFill} /></div>
                <div className={styles.modalActions}>
                    {!recording ? (
                        <button className={styles.primaryBtn} onClick={start}>🎙 Start</button>
                    ) : (
                        <button className={styles.secondaryBtn} onClick={stop}>⏹ Stop</button>
                    )}
                </div>
                {score && (
                    <div className={styles.subcard} style={{ marginTop: 8 }}>
                        <div><strong>Score:</strong> {Math.round(score.score * 100)} / 100</div>
                        <div className={styles.dim} style={{ marginTop: 6 }}>{msg}</div>
                        {(!lastTranscriptRef.current) && (
                            <div style={{ marginTop: 8 }}>
                                <label className={styles.dim} style={{ display: "block", marginBottom: 4 }}>
                                    Couldn’t hear you? Type what you said:
                                </label>
                                <input
                                    type="text"
                                    style={{ width: "100%", padding: 8, border: "1px solid #e5e7eb", borderRadius: 8 }}
                                    onChange={(e) => {
                                        const s = scorePronunciation(text || "", e.target.value);
                                        setScore(s);
                                        setMsg(s.tips);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}