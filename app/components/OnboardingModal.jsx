"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "learnloom_onboarding_dismissed_v1";

// Routes where a first-visit walkthrough would be unhelpful or out of place:
// admin tooling, the guide page itself (redundant), and focused reading/quiz views.
const SKIP_PREFIXES = ["/admin", "/help"];

export default function OnboardingModal() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const dialogRef = useRef(null);
    const closeBtnRef = useRef(null);

    useEffect(() => {
        if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return;
        try {
            if (!localStorage.getItem(STORAGE_KEY)) {
                setOpen(true);
            }
        } catch {
            // localStorage unavailable (e.g. private browsing edge cases) — skip onboarding
            // rather than risk showing it on every page load.
        }
        // Only check on mount / pathname change into an eligible route.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    useEffect(() => {
        if (open) closeBtnRef.current?.focus();
    }, [open]);

    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape") dismiss();
        }
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function dismiss() {
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch {
            // ignore — worst case the modal reappears next visit
        }
        setOpen(false);
    }

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            ref={dialogRef}
            onClick={(e) => {
                if (e.target === dialogRef.current) dismiss();
            }}
            style={backdrop}
        >
            <div style={panel}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <h2 id="onboarding-title" style={{ margin: 0, flex: 1, fontSize: 24 }}>
                        Welcome to LearnLoom
                    </h2>
                    <button
                        ref={closeBtnRef}
                        onClick={dismiss}
                        aria-label="Close welcome guide"
                        style={closeBtn}
                    >
                        ×
                    </button>
                </div>

                <p style={{ marginTop: 8, color: "#4b5563" }}>
                    A quick look at what you can do here. This won&apos;t show again after you close it —
                    you can revisit it anytime from <strong>Help</strong> in the navigation bar.
                </p>

                <ul style={list}>
                    <li>
                        <strong>Library</strong> — browse books by genre, level, and topic to find something
                        that fits you.
                    </li>
                    <li>
                        <strong>Reading Pal</strong> — read with text-to-speech, sentence highlighting,
                        adjustable font size and colors.
                    </li>
                    <li>
                        <strong>Study Grammar</strong> — practice with instant, explained feedback, not just
                        right/wrong.
                    </li>
                    <li>
                        <strong>Your code</strong> — LearnLoom doesn&apos;t ask for your name or email. A short
                        code (shown in the nav bar once you start) is how your progress is saved and how you
                        log back in on any device.
                    </li>
                </ul>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                    <Link href="/help" style={secondaryBtn} onClick={dismiss}>
                        View full guide
                    </Link>
                    <button onClick={dismiss} style={primaryBtn}>
                        Got it, let&apos;s start
                    </button>
                </div>
            </div>
        </div>
    );
}

const backdrop = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
};

const panel = {
    width: "min(560px, 96vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 16px 28px rgba(0,0,0,.18)",
    padding: 20,
};

const list = {
    margin: "12px 0",
    paddingLeft: 20,
    color: "#374151",
    lineHeight: 1.6,
    display: "grid",
    gap: 8,
};

const closeBtn = {
    background: "transparent",
    border: "none",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
    color: "#6b7280",
    padding: 4,
};

const primaryBtn = {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
};

const secondaryBtn = {
    background: "#e9eefc",
    color: "#0b3b9f",
    border: "1px solid #c9d7fb",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    textDecoration: "none",
};
