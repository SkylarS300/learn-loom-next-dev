"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function UploadReader({ upload }) {
    const [unlocked, setUnlocked] = useState(!upload.password);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [uploadContent, setUploadContent] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // NEW: resume/sync state
    const [paragraphs, setParagraphs] = useState([]);
    const [resumeDone, setResumeDone] = useState(false);
    const containerRef = useRef(null);
    const saveTimerRef = useRef(null);

    // --- helpers ---
    const splitToParagraphs = (text) => {
        // split on blank lines; keep non-empty; trim to clean up tails
        const parts = (text || "")
            .split(/\n{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);
        return parts.length ? parts : [text || ""];
    };

    const queueSave = (paraIndex, charOffset = 0) => {
        if (!upload?.id) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(
            () => saveProgress(paraIndex, charOffset),
            400
        );
    };

    const saveProgress = async (paraIndex, charOffset = 0) => {
        try {
            await fetch("/api/uploadprogress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uploadId: upload.id,
                    paraIndex,
                    charOffset,
                }),
            });
        } catch (e) {
            console.warn("uploadprogress POST failed (non-fatal):", e);
        }
    };

    const restoreProgress = async () => {
        if (!upload?.id || !paragraphs.length) return;
        try {
            const res = await fetch(`/api/uploadprogress?uploadId=${upload.id}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data) return;
            const idx = Math.min(
                typeof data.paraIndex === "number" ? data.paraIndex : 0,
                Math.max(paragraphs.length - 1, 0)
            );
            const host = containerRef.current;
            if (!host) return;
            const el = host.querySelector(`[data-pi="${idx}"]`);
            if (el) {
                el.scrollIntoView({ block: "start" });
                // optional: a quick flash to show where we resumed
                el.classList.add("highlight-progress");
                setTimeout(() => el.classList.remove("highlight-progress"), 1200);
            }
        } catch (e) {
            console.warn("uploadprogress GET failed (non-fatal):", e);
        } finally {
            setResumeDone(true);
        }
    };

    const handleScroll = () => {
        const host = containerRef.current;
        if (!host) return;

        const hostTop = host.getBoundingClientRect().top;
        const items = host.querySelectorAll("[data-pi]");
        let candidate = 0;
        let best = Infinity;

        items.forEach((el) => {
            const r = el.getBoundingClientRect();
            // choose the closest paragraph at/just below the top of the scroll area
            const dist = Math.abs(r.top - hostTop);
            if (r.top >= hostTop - 10 && dist < best) {
                best = dist;
                candidate = Number(el.dataset.pi);
            }
        });

        queueSave(candidate, 0);
    };

    // --- existing view logging + content fetch ---
    useEffect(() => {
        if (unlocked && upload?.id) {
            // track that the anon user viewed this upload
            fetch("/api/uploadview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id }),
            });

            setUploadContent(upload.content);
        }
    }, [unlocked, upload]);

    // build paragraphs when content arrives
    useEffect(() => {
        if (typeof uploadContent === "string") {
            setParagraphs(splitToParagraphs(uploadContent));
            setResumeDone(false);
        } else {
            setParagraphs([]);
        }
    }, [uploadContent]);

    // try to restore saved position after paragraphs render
    useEffect(() => {
        if (unlocked && upload?.id && paragraphs.length && !resumeDone) {
            restoreProgress();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unlocked, upload?.id, paragraphs.length, resumeDone]);

    // --- password unlock flow (unchanged) ---
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

                const full = await fetch(`/api/uploads/${upload.id}`);
                if (full.ok) {
                    const data = await full.json();
                    setUploadContent(data.content);
                }
            } else {
                const text = await res.text();
                setError(text || "Incorrect password");
            }
        } finally {
            setLoading(false);
        }
    }

    if (!unlocked) {
        return (
            <div className="upload-reader locked">
                <h1>{upload.title}</h1>
                <p>This upload is password-protected.</p>
                <div className="password-wrapper">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="password-input"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="eye-toggle"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <button onClick={handleUnlock} disabled={loading} className="cta-button">
                    {loading ? "Unlocking..." : "Unlock"}
                </button>
                {error && <p className="error">{error}</p>}
            </div>
        );
    }

    return (
        <div className="upload-reader">
            <h1>{upload.title}</h1>

            {/* Scrollable container that tracks & saves position */}
            <div
                className="upload-text"
                ref={containerRef}
                onScroll={handleScroll}
                style={{
                    maxHeight: 400,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                }}
            >
                {paragraphs.map((para, idx) => (
                    <p
                        key={idx}
                        data-pi={idx}
                        onClick={() => queueSave(idx, 0)}
                        style={{ margin: "0 0 1em 0", cursor: "pointer" }}
                    >
                        {para}
                    </p>
                ))}
            </div>
        </div>
    );
}
