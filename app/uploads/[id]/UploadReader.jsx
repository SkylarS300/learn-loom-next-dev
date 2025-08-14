"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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

    // Record a view + load content + fetch saved progress
    useEffect(() => {
        if (!unlocked || !upload?.id) return;

        // log a view
        fetch("/api/uploadview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: upload.id }),
        }).catch(() => { });

        // set whatever we already have
        setUploadContent(upload.content ?? "");

        // try to load saved progress
        (async () => {
            try {
                const res = await fetch(`/api/uploadprogress?uploadId=${upload.id}`);
                if (res.ok && res.status !== 204) {
                    const data = await res.json();
                    if (data?.paraIndex != null) {
                        setResume({
                            paraIndex: Number(data.paraIndex),
                            charOffset: Number(data.charOffset ?? 0),
                        });
                    }
                }
            } catch { }
        })();
    }, [unlocked, upload]);

    // Autosave current paragraph on scroll (throttled via rAF)
    useEffect(() => {
        if (!unlocked || !uploadContent) return;
        const cont = containerRef.current;
        if (!cont) return;

        let pending = null;

        const saveProgress = async (pi) => {
            try {
                await fetch("/api/uploadprogress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uploadId: upload.id, paraIndex: pi, charOffset: 0 }),
                });
            } catch (e) {
                // swallow: non-critical
            }
        };

        const onScroll = () => {
            if (pending) return;
            pending = requestAnimationFrame(() => {
                pending = null;
                const rectTop = cont.getBoundingClientRect().top;

                // nearest paragraph to container top (with small bias)
                let bestIdx = 0;
                let bestDelta = Infinity;
                paraRefs.current.forEach((el, i) => {
                    if (!el) return;
                    const d = Math.abs(el.getBoundingClientRect().top - rectTop - 20);
                    if (d < bestDelta) {
                        bestDelta = d;
                        bestIdx = i;
                    }
                });

                saveProgress(bestIdx);
            });
        };

        cont.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            cont.removeEventListener("scroll", onScroll);
            if (pending) cancelAnimationFrame(pending);
        };
    }, [unlocked, uploadContent, upload?.id]);


    // Time heartbeat: post deltaTimeMs every ~5s; flush on hide/unload
    useEffect(() => {
        if (!unlocked || !uploadContent || !upload?.id) return;
        lastTickRef.current = performance.now();

        const postDelta = (ms) => {
            const delta = Math.max(0, Math.round(ms || 0));
            if (!delta) return;
            fetch("/api/uploadprogress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id, deltaTimeMs: delta }),
            }).catch(() => { });
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
                        new Blob([JSON.stringify({ uploadId: upload.id, deltaTimeMs: Math.max(0, Math.round(dt)) })],
                            { type: "application/json" })
                    );
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
                    new Blob([JSON.stringify({ uploadId: upload.id, deltaTimeMs: Math.max(0, Math.round(dt)) })],
                        { type: "application/json" })
                );
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
            containerRef.current.scrollTo({
                top: el.offsetTop - 10,
                behavior: "smooth",
            });
        }
        setResume(null);
    }

    async function handleUnlock() {
        setLoading(true);
        try {
            const res = await fetch("/api/unlockupload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id, password }),
            });

            if (res.ok) {
                setUnlocked(true);
                setError("");
                setPassword("");

                // fetch full content after unlock
                const full = await fetch(`/api/uploads/${upload.id}`);
                if (full.ok) {
                    const data = await full.json();
                    setUploadContent(data.content ?? "");
                }
            } else {
                const text = await res.text();
                setError(text || "Incorrect password");
            }
        } catch {
            setError("Server error");
        } finally {
            setLoading(false);
        }
    }

    // ——— Owner controls (render in both locked/unlocked) ———
    const ownerControls = isOwner ? (
        <div style={{ margin: "6px 0 12px", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontWeight: 600 }}>Visibility:</label>
                <select value={vis} onChange={(e) => setVis(e.target.value)}>
                    <option value="PRIVATE">Private (only you)</option>
                    <option value="PUBLIC">Public (listed in Community)</option>
                    <option value="CODED">Share code (not listed; show by code)</option>
                </select>
                <button
                    className="cta-button small"
                    disabled={savingVis}
                    onClick={async () => {
                        setSavingVis(true);
                        try {
                            const r = await fetch(`/api/uploadedtext/${upload.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ visibility: vis }),
                            });
                            const j = await r.json();
                            if (j?.ok) {
                                setVis(j.data.visibility);
                                setCode(j.data.shareCode || "");
                            }
                        } finally {
                            setSavingVis(false);
                        }
                    }}
                >
                    Save
                </button>
            </div>
            {vis === "CODED" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>
                        <strong>Share code:</strong>{" "}
                        {code ? <code>{code}</code> : <em>(will be generated on save)</em>}
                    </span>
                    {code && (
                        <>
                            <button
                                className="cta-button small"
                                onClick={async () => {
                                    await navigator.clipboard?.writeText(code);
                                    alert("Code copied");
                                }}
                            >
                                Copy
                            </button>
                            +                <button
                                className="cta-button small"
                                onClick={async () => {
                                    const link = `${window.location.origin}/uploads/${upload.id}?code=${encodeURIComponent(code)}`;
                                    await navigator.clipboard?.writeText(link);
                                    alert("Share link copied");
                                }}
                            >
                                Copy link
                            </button>
                        </>
                    )}
                    <button
                        className="cta-button small"
                        onClick={async () => {
                            const r = await fetch(`/api/uploadedtext/${upload.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "regenCode" }),
                            });
                            const j = await r.json();
                            if (j?.ok) setCode(j.data.shareCode || "");
                        }}
                    >
                        Regenerate
                    </button>
                </div>
            )}
            {upload.password ? <div style={{ color: "#555" }}>🔒 Password protected</div> : null}
        </div>
    ) : null;

    if (!unlocked) {
        return (
            <div className="upload-reader locked">
                <h1>{upload.title}</h1>
                {ownerControls}

                {/* Visitors: if CODED and content hidden, offer code save */}
                {!isOwner && upload.visibility === "CODED" && uploadContent == null && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 12px" }}>
                        <input
                            value={shareCodeInput}
                            onChange={(e) => setShareCodeInput(e.target.value)}
                            placeholder="Enter share code"
                            style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                            aria-label="Enter share code"
                        />
                        <button
                            className="cta-button small"
                            onClick={async () => {
                                const code = (shareCodeInput || "").trim();
                                if (!code) return;
                                await fetch("/api/sharecode", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ code }),
                                });
                                // reload with ?code= to unlock this page immediately as well
                                const url = new URL(window.location.href);
                                url.searchParams.set("code", code);
                                window.location.href = url.toString();
                            }}
                        >
                            Save code
                        </button>
                    </div>
                )}
                <p>This upload is password-protected.</p>

                <div className="password-wrapper" style={{ position: "relative", display: "flex", gap: 8 }}>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="password-input"
                        style={{ flex: 1 }}
                        aria-invalid={!!error}
                        aria-describedby={error ? "upload-password-error" : undefined}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="eye-toggle"
                        aria-label="toggle password visibility"
                        style={{ display: "grid", placeItems: "center", width: 36 }}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>

                <button onClick={handleUnlock} disabled={loading} className="cta-button" style={{ marginTop: 8 }}>
                    {loading ? "Unlocking..." : "Unlock"}
                </button>

                {error && (
                    <p
                        id="upload-password-error"
                        className="error"
                        style={{ color: "#d33", marginTop: 8 }}
                        role="alert"
                        aria-live="polite"
                    >
                        {error}
                    </p>
                )}            </div>
        );
    }

    return (
        <div className="upload-reader">
            <h1>{upload.title}</h1>
            {ownerControls}

            {resume && (
                <div className="progress-banner" style={{ margin: "0 0 10px", display: "flex", gap: 8, alignItems: "center" }}>
                    <span>Resume where you left off?</span>
                    <button className="cta-button small" onClick={handleResume}>Resume</button>
                    <button className="cta-button small" onClick={() => setResume(null)}>Dismiss</button>
                </div>
            )}

            <div
                ref={containerRef}
                className="upload-text"
                style={{
                    maxHeight: 400,
                    overflowY: "auto",
                    padding: 16,
                    background: "#f8f8f8",
                    borderRadius: 8,
                }}
            >
                {(uploadContent ?? "")
                    .split(/\n{2,}/g) // paragraphs separated by blank lines
                    .map((para, i) => (
                        <p
                            key={i}
                            ref={(el) => (paraRefs.current[i] = el)}
                            data-pi={i}
                            style={{ margin: "0 0 1rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                        >
                            {para}
                        </p>
                    ))}
            </div>
        </div>
    );
}
