"use client";
import { useEffect, useState } from "react";

export default function UploadReader({ upload }) {
    const [unlocked, setUnlocked] = useState(!upload.password); // If not locked, already unlocked
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [uploadContent, setUploadContent] = useState(null);

    // Track view if unlocked
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
        const res = await fetch("/api/unlockupload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: upload.id, password }),
        });

        if (res.ok) {
            setUnlocked(true);
            setError("");
            setPassword("");

            // Re-fetch full upload
            const full = await fetch(`/api/uploads/${upload.id}`);
            if (full.ok) {
                const data = await full.json();
                setUploadContent(data.content);
            }
        } else {
            const text = await res.text();
            setError(text || "Incorrect password");
        }
    }


    if (!unlocked) {
        return (
            <div className="upload-reader locked">
                <h1>{upload.title}</h1>
                <p>This upload is password-protected.</p>
                <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="password-input"
                />
                <button onClick={handleUnlock}>Unlock</button>
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
