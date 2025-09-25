"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../upload.module.css";

export default function UploadReader({ upload, isOwner = false }) {
    const [unlocked, setUnlocked] = useState(!upload.password);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [uploadContent, setUploadContent] = useState(null);
    const [vis, setVis] = useState(upload.visibility || "PRIVATE");
    const [code, setCode] = useState(upload.shareCode || "");
    const [savingVis, setSavingVis] = useState(false);
    const [shareCodeInput, setShareCodeInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // resume: { paraIndex, charOffset }
    const [resume, setResume] = useState(null);

    const containerRef = useRef(null);
    const lastTickRef = useRef(0);
    const hbRef = useRef(null);
    const paraRefs = useRef([]);

    /* ----- on unlock load content + progress ----- */
    useEffect(() => {
        if (!unlocked || !upload?.id) return;

        fetch("/api/uploadview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: upload.id }),
        }).catch(() => { });

        setUploadContent(upload.content ?? "");

        (async () => {
            try {
                const res = await fetch(`/api/uploadprogress?uploadId=${upload.id}`);
                if (res.ok && res.status !== 204) {
                    const data = await res.json();
                    if (data?.paraIndex != null) {
                        setResume({ paraIndex: Number(data.paraIndex), charOffset: Number(data.charOffset ?? 0) });
                    }
                }
            } catch { }
        })();
    }, [unlocked, upload]);

    /* ----- autosave paragraph by scroll ----- */
    useEffect(() => {
        if (!unlocked || !uploadContent) return;
        const cont = containerRef.current;
        if (!cont) return;

        let pending = null;
        let debounce = null;
        let lastSavedIdx = -1;

        const saveProgress = async (pi) => {
            if (pi === lastSavedIdx) return;
            lastSavedIdx = pi;
            try {
                await fetch("/api/uploadprogress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uploadId: upload.id, paraIndex: pi, charOffset: 0 }),
                });
            } catch { }
        };

        const onScroll = () => {
            if (pending) return;
            pending = requestAnimationFrame(() => {
                pending = null;
                const rectTop = cont.getBoundingClientRect().top;
                let bestIdx = 0, bestDelta = Infinity;
                paraRefs.current.forEach((el, i) => {
                    if (!el) return;
                    const d = Math.abs(el.getBoundingClientRect().top - rectTop - 20);
                    if (d < bestDelta) { bestDelta = d; bestIdx = i; }
                });
                if (debounce) clearTimeout(debounce);
                debounce = setTimeout(() => saveProgress(bestIdx), 800);
            });
        };

        cont.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            cont.removeEventListener("scroll", onScroll);
            if (pending) cancelAnimationFrame(pending);
            if (debounce) clearTimeout(debounce);
        };
    }, [unlocked, uploadContent, upload?.id]);

    /* ----- heartbeat time ----- */
    useEffect(() => {
        if (!unlocked || !uploadContent || !upload?.id) return;
        lastTickRef.current = performance.now();

        const ping = () => {
            try {
                const blob = new Blob([JSON.stringify({ mode: "upload" })], { type: "application/json" });
                if (navigator.sendBeacon) { navigator.sendBeacon("/api/live/ping", blob); return; }
            } catch { }
            fetch("/api/live/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "upload" }) }).catch(() => { });
        };

        const postDelta = (ms) => {
            const delta = Math.max(0, Math.round(ms || 0));
            if (!delta) return;
            fetch("/api/uploadprogress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id, deltaTimeMs: delta }),
            }).catch(() => { });
            ping();
        };

        hbRef.current = setInterval(() => {
            const now = performance.now();
            const dt = now - lastTickRef.current;
            lastTickRef.current = now;
            postDelta(dt);
        }, 5000);

        const onVisibility = () => {
            if (document.hidden) {
                const now = performance.now();
                const dt = now - lastTickRef.current;
                lastTickRef.current = now;
                try {
                    navigator.sendBeacon?.(
                        "/api/uploadprogress",
                        new Blob([JSON.stringify({ uploadId: upload.id, deltaTimeMs: Math.max(0, Math.round(dt)) })], { type: "application/json" })
                    );
                    navigator.sendBeacon?.("/api/live/ping", new Blob([JSON.stringify({ mode: "upload" })], { type: "application/json" }));
                } catch { }
            }
        };
        const onBeforeUnload = () => {
            const now = performance.now();
            const dt = now - lastTickRef.current;
            lastTickRef.current = now;
            try {
                navigator.sendBeacon?.(
                    "/api/uploadprogress",
                    new Blob([JSON.stringify({ uploadId: upload.id, deltaTimeMs: Math.max(0, Math.round(dt)) })], { type: "application/json" })
                );
                navigator.sendBeacon?.("/api/live/ping", new Blob([JSON.stringify({ mode: "upload" })], { type: "application/json" }));
            } catch { }
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            clearInterval(hbRef.current);
            hbRef.current = null;
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, [unlocked, uploadContent, upload?.id]);

    function handleResume() {
        if (resume?.paraIndex == null) return;
        const el = paraRefs.current[resume.paraIndex];
        if (el && containerRef.current) {
            containerRef.current.scrollTo({ top: el.offsetTop - 10, behavior: "smooth" });
        }
        fetch("/api/uploadprogress", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: upload.id, paraIndex: Number(resume.paraIndex) || 0, charOffset: 0 }),
        }).catch(() => { });
        setResume(null);
    }

    async function handleUnlock() {
        setLoading(true);
        try {
            const res = await fetch("/api/unlockupload", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id, password }),
            });

            if (res.ok) {
                setUnlocked(true);
                setError("");
                setPassword("");
                const full = await fetch(`/api/uploads/${upload.id}`);
                if (full.ok) {
                    const data = await full.json();
                    setUploadContent(data.content ?? "");
                }
            } else {
                let msg = "Incorrect password";
                try { msg = (await res.json())?.error || msg; } catch {
                    const text = await res.text(); if (text) msg = text;
                }
                setError(msg);
            }
        } catch {
            setError("Server error");
        } finally {
            setLoading(false);
        }
    }

    /* ----- owner controls ----- */
    const ownerControls = isOwner ? (
        <div style={{ margin: "6px 0 12px", display: "grid", gap: 8 }}>
            <div className={styles.row}>
                <label style={{ fontWeight: 600 }}>Visibility:</label>
                <select value={vis} onChange={(e) => setVis(e.target.value)} className={styles.input} style={{ maxWidth: 260 }}>
                    <option value="PRIVATE">Private (only you)</option>
                    <option value="PUBLIC">Public (listed in Community)</option>
                    <option value="CODED">Share code (not listed; show by code)</option>
                </select>
                <button className={`${styles.btn} ${styles.small}`} disabled={savingVis}
                    onClick={async () => {
                        setSavingVis(true);
                        try {
                            const r = await fetch(`/api/uploads/${upload.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ visibility: vis }),
                            });
                            const j = await r.json();
                            if (j?.ok) { setVis(j.data.visibility); setCode(j.data.shareCode || ""); }
                            else if (j?.visibility) { setVis(j.visibility); setCode(j.shareCode || ""); } // direct payload
                        } finally { setSavingVis(false); }
                    }}
                >Save</button>
            </div>

            {vis === "CODED" && (
                <div className={styles.row}>
                    <span>
                        <strong>Share code:</strong>{" "}
                        {code ? <code>{code}</code> : <em>(will be generated on save)</em>}
                    </span>
                    {code && (
                        <>
                            <button className={`${styles.btnSecondary} ${styles.small}`}
                                onClick={async () => { await navigator.clipboard?.writeText(code); alert("Code copied"); }}>
                                Copy
                            </button>
                            <button className={`${styles.btnSecondary} ${styles.small}`}
                                onClick={async () => {
                                    const link = `${window.location.origin}/uploads/${upload.id}?code=${encodeURIComponent(code)}`;
                                    await navigator.clipboard?.writeText(link);
                                    alert("Share link copied");
                                }}>
                                Copy link
                            </button>
                        </>
                    )}
                    <button className={`${styles.btnSecondary} ${styles.small}`}
                        onClick={async () => {
                            const r = await fetch(`/api/uploads/${upload.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "regenCode" }),
                            });
                            const j = await r.json();
                            if (j?.ok) setCode(j.data.shareCode || "");
                            else if (j?.shareCode) setCode(j.shareCode || "");
                        }}>
                        Regenerate
                    </button>
                </div>
            )}
            {upload.password ? <div style={{ color: "#555" }}>🔒 Password protected</div> : null}
        </div>
    ) : null;

    /* ----- render ----- */
    if (!unlocked) {
        return (
            <div className={styles.wrap}>
                <h1 className={styles.h1}>{upload.title}</h1>
                {ownerControls}

                {!isOwner && upload.visibility === "CODED" && uploadContent == null && (
                    <div className={styles.banner}>
                        <input
                            value={shareCodeInput}
                            onChange={(e) => setShareCodeInput(e.target.value)}
                            placeholder="Enter share code"
                            className={styles.input}
                            style={{ maxWidth: 260 }}
                            aria-label="Enter share code"
                        />
                        <button
                            className={`${styles.btnSecondary} ${styles.small}`}
                            onClick={async () => {
                                const code = (shareCodeInput || "").trim();
                                if (!code) return;
                                await fetch("/api/sharecode", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ code }),
                                });
                                const url = new URL(window.location.href);
                                url.searchParams.set("code", code);
                                window.location.href = url.toString();
                            }}
                        >
                            Save code
                        </button>
                    </div>
                )}

                <div className={styles.lockedBox}>
                    <p>This upload is password-protected.</p>
                    <div className={styles.row} style={{ position: "relative" }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            aria-invalid={!!error}
                            aria-describedby={error ? "upload-password-error" : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className={styles.btnSecondary}
                            aria-label="toggle password visibility"
                            style={{ width: 40, display: "grid", placeItems: "center" }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <button onClick={handleUnlock} disabled={loading} className={styles.btn} style={{ marginTop: 8 }}>
                        {loading ? "Unlocking..." : "Unlock"}
                    </button>
                    {error && (
                        <p id="upload-password-error" className={styles.error} role="alert" aria-live="polite">
                            {error}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>{upload.title}</h1>
            {ownerControls}

            {resume && (
                <div className={styles.banner} role="status" aria-live="polite">
                    <span>Resume where you left off?</span>
                    <button className={`${styles.btnSecondary} ${styles.small}`} onClick={handleResume}>Resume</button>
                    <button className={`${styles.btnSecondary} ${styles.small}`} onClick={() => setResume(null)}>Dismiss</button>
                </div>
            )}

            <div ref={containerRef} className={styles.textBox}>
                {(uploadContent ?? "")
                    .split(/\n{2,}/g)
                    .map((para, i) => (
                        <p key={i} ref={(el) => (paraRefs.current[i] = el)} data-pi={i} className={styles.p}>
                            {para}
                        </p>
                    ))}
            </div>
        </div>
    );
}
