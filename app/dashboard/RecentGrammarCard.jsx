"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function Sparkline({ series }) {
    const data = series.map(d => ({ x: new Date(d.t).getTime(), y: d.score }));
    return (
        <div style={{ width: "100%", height: 60 }}>
            <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <XAxis dataKey="x" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                        formatter={(value, name) => (name === "y" ? [`${value}`, "Score"] : value)}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    {/* No explicit colors per project rules */}
                    <Line type="monotone" dataKey="y" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function RecentGrammarCard() {
    const [loading, setLoading] = useState(true);
    const [topThree, setTopThree] = useState([]);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const res = await fetch("/api/grammar/stats?recent=1&limit=60&days=45", { cache: "no-store" });
                const json = await res.json();
                if (isMounted && json?.ok) setTopThree(json.data.topThree ?? []);
            } catch (e) {
                console.error("RecentGrammarCard fetch error:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    return (
        <section
            aria-label="Recent grammar"
            style={{
                border: "1px solid #e5e5e5",
                background: "#fff",
                borderRadius: 8,
                padding: 16,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
        >
            <h3 style={{ marginTop: 0 }}>🧠 Recent grammar</h3>
            <p style={{ marginTop: 0, color: "#666" }}>
                Your last three subtopics with mini trends.
            </p>

            {loading && <div>Loading…</div>}

            {!loading && topThree.length === 0 && (
                <div style={{ color: "#666" }}>No recent grammar activity yet. Try a quiz to see trends here.</div>
            )}

            {!loading && topThree.length > 0 && (
                <div
                    role="list"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: 12,
                        marginTop: 8,
                    }}
                >
                    {topThree.map((t) => (
                        <div
                            key={`${t.concept}:::${t.subTopic}`}
                            role="listitem"
                            style={{
                                border: "1px solid #e5e5e5",
                                borderRadius: 8,
                                padding: 12,
                                background: "#fff",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>{t.concept}</div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t.subTopic}</div>
                                </div>
                                <div aria-label="Latest score" style={{ fontWeight: 600 }}>
                                    {t.latestScore ?? "—"}
                                </div>
                            </div>
                            <Sparkline series={t.series} />
                            {t.last3?.length > 0 && (
                                <div style={{ fontSize: 12, color: "#666" }}>
                                    Last 3: {t.last3.map((s, i) => <span key={i}>{s}{i < t.last3.length - 1 ? " • " : ""}</span>)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
