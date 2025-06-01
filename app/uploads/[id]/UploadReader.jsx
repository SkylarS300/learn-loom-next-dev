"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function UploadReader({ upload }) {
    const [unlocked, setUnlocked] = useState(!upload.password);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [uploadContent, setUploadContent] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (unlocked && upload?.id) {
            fetch("/api/uploadview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: upload.id }),
            });

            setUploadContent(upload.content);
        }
    }, [unlocked, upload]);

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
            <pre className="upload-text">{uploadContent}</pre>
        </div>
    );
}
