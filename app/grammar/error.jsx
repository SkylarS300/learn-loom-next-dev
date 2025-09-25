"use client";
export default function GrammarError({ error, reset }) {
    // Next will pass the error here on client navigation failures
    console.error("[Grammar route error]", error);
    return (
        <main style={{ maxWidth: 620, margin: "32px auto", padding: 16 }}>
            <h1>Something went wrong</h1>
            <p style={{ color: "#6b7280" }}>Grammar failed to load.</p>
            <pre style={{ whiteSpace: "pre-wrap", background: "#f9fafb", border: "1px solid #e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
                {(error?.message || String(error || ""))}
            </pre>
            <button onClick={() => reset()} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer" }}>
                Try again
            </button>
        </main>
    );
}
