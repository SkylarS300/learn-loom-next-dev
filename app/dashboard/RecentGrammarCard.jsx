"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function Sparkline({ series, height = 60 }) {
    const data = (series || []).map(d => ({ x: new Date(d.t).getTime(), y: clampScore(d.score) }));
    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
                    <XAxis dataKey="x" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                        formatter={(value, name) => (name === "y" ? [`${Math.round(value)}%`, "Score"] : value)}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                        contentStyle={tooltipBox}
                    />
                    <Line type="monotone" dataKey="y" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function RecentGrammarCard() {
    const [loading, setLoading] = useState(true);
    const [topThree, setTopThree] = useState([]);
    const [allRows, setAllRows] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const res = await fetch("/api/grammar/stats?recent=1&limit=60&days=45", { cache: "no-store" });
                const json = await res.json();
                if (isMounted) {
                    if (!json?.ok) throw new Error(json?.error || "Failed to load");
                    setTopThree(json.data.topThree ?? []);
                }
            } catch (e) {
                if (isMounted) setErr(e.message || "Failed to load recent grammar");
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, []);


    return (
        <section aria-label="Recent grammar" style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0 }}>🧠 Recent grammar</h3>
                <span title="Last 45 days" style={badge}>Sparkline</span>
                <button
                    style={{ ...linkBtn, marginLeft: "auto" }}
                    onClick={async () => {
                        try {
                            setShowModal(true);
                            // lazy-load the full list the first time
                            if (!allRows.length) {
                                const r = await fetch("/api/grammar/stats?recent=1&limit=200&days=90&all=1", { cache: "no-store" });
                                const j = await r.json();
                                if (j?.ok) setAllRows(j.data?.all || []);
                            }
                        } catch { /* noop */ }
                    }}
                >
                    Show more
                </button>
            </div>

            <p style={{ margin: "6px 0 0", color: "#666" }}>
                Your last three subtopics with mini trends.
            </p>

            {loading && <div>Loading…</div>}
            {err && <div style={{ color: "#c0392b" }}>{err}</div>}

            {!loading && !err && topThree.length === 0 && (
                <div style={{ color: "#666" }}>No recent grammar activity yet. Try a quiz to see trends here.</div>
            )}

            {!loading && !err && topThree.length > 0 && (
                <div role="list" style={grid3}>
                    {topThree.map((t) => (
                        <MiniTile key={`${t.concept}:::${t.subTopic}`} row={t} />
                    ))}
                </div>
            )}

            {showModal && (
                <AllTrendsModal rows={allRows} onClose={() => setShowModal(false)} />
            )}
        </section>
    );



}

function MiniTile({ row }) {
    const { concept, subTopic, series, latestScore } = row;
    const tail = (series || []).slice(-20).map((d, idx) => ({ x: idx + 1, y: clampScore(d.score) }));
    const delta = tail.length >= 2 ? tail[tail.length - 1].y - tail[tail.length - 2].y : 0;
    const up = delta > 0, flat = delta === 0;
    return (
        <div role="listitem" style={tile}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>{concept}</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{subTopic}</div>
                </div>
                <div aria-label="Trend" title={up ? `Up ${delta.toFixed(0)} pts` : flat ? "No change" : `Down ${Math.abs(delta).toFixed(0)} pts`} style={pill(up, flat)}>
                    {up ? "▲" : flat ? "•" : "▼"}
                </div>
            </div>
            <Sparkline series={series} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#666" }}>
                    Latest: <strong>{isFinite(latestScore) ? Math.round(latestScore) : "—"}%</strong>
                </div>
                <button
                    style={{ ...btn, marginLeft: "auto" }}
                    onClick={() => {
                        const href = `/grammar?concept=${encodeURIComponent(concept)}&subTopic=${encodeURIComponent(subTopic)}&start=1`;
                        window.location.href = href;
                    }}
                >
                    Practice
                </button>
            </div>
        </div>
    );
}

function AllTrendsModal({ rows, onClose }) {
    const [q, setQ] = useState("");
    const filtered = (rows || []).filter(r => {
        const hay = `${r.concept} ${r.subTopic}`.toLowerCase();
        return hay.includes(q.toLowerCase());
    });
    return (
        <div role="dialog" aria-modal="true" style={modalBackdrop}>
            <div style={modalCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, flex: 1 }}>All recent subtopics</h3>
                    <button style={btn} onClick={onClose}>Close</button>
                </div>
                <input
                    placeholder="Filter by name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={searchInput}
                />
                {filtered.length === 0 ? (
                    <p className="dim">No matches.</p>
                ) : (
                    <div style={gridAll}>
                        {filtered.map((r, i) => (
                            <div key={`${r.concept}:::${r.subTopic}:::${i}`} style={tile}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                    <div>
                                        <div style={{ fontSize: 13, opacity: 0.8 }}>{r.concept}</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>{r.subTopic}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#666" }}>Attempts: {r.series?.length ?? 0}</div>
                                </div>
                                <Sparkline series={r.series} height={120} />
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 12, color: "#666" }}>
                                        Latest: <strong>{isFinite(r.latestScore) ? Math.round(r.latestScore) : "—"}%</strong>
                                    </div>
                                    <button
                                        style={{ ...btn, marginLeft: "auto" }}
                                        onClick={() => {
                                            const href = `/grammar?concept=${encodeURIComponent(r.concept)}&subTopic=${encodeURIComponent(r.subTopic)}&start=1`;
                                            window.location.href = href;
                                        }}
                                    >
                                        Practice
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ------- utils ------- */
function clampScore(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
}

/* ------- styles ------- */
const cardStyle = {
    border: "1px solid #e5e5e5",
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
const grid3 = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 8,
};
const gridAll = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 12,
};
const tile = {
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: 12,
    background: "#fff",
};
const tooltipBox = {
    borderRadius: 8,
    border: "1px solid #e5e5e5",
    boxShadow: "0 8px 12px rgba(0,0,0,0.08)",
    padding: "6px 8px",
};
const btn = {
    background: "#e9eefc",
    color: "#0b3b9f",
    border: "1px solid #c9d7fb",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
};
const linkBtn = {
    background: "transparent",
    border: "none",
    color: "#0b3b9f",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
};
const badge = {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    userSelect: "none",
};
const pill = (up, flat) => ({
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: up ? "#ecfdf5" : flat ? "#f3f4f6" : "#fef2f2",
    color: up ? "#065f46" : flat ? "#374151" : "#991b1b",
});
const modalBackdrop = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
};
const modalCard = {
    width: "min(980px, 96vw)",
    maxHeight: "88vh",
    overflow: "auto",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
};
const searchInput = {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "8px 10px",
    marginTop: 10,
};

