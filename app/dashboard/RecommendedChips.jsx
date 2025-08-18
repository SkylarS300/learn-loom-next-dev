// app/dashboard/RecommendedChips.jsx
"use client";

import { memo, useEffect, useState } from "react";
import styles from "./Dashboard.module.css";

function RecommendedChipsImpl() {
    const [rows, setRows] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch("/api/grammar/recommendations");
                const j = await r.json();
                if (j?.ok) setRows(j.data || []);
            } catch { }
        })();
    }, []);

    if (!rows.length) return null;
    return (
        <div className={styles.chips}>
            {rows.map((r, i) => {
                const href = `/grammar?concept=${encodeURIComponent(r.concept)}&subTopic=${encodeURIComponent(r.subTopic)}&start=1`;
                const title =
                    `Attempts ${r.attempts} · Acc ${Math.round((r.accuracy || 0) * 100)}%` +
                    (typeof r.avgSecPerQ === "number" ? ` · Pace ${r.avgSecPerQ.toFixed(1)}s/q` : "") +
                    (typeof r.avgHintsPerQ === "number" && r.avgHintsPerQ > 0 ? ` · Hints ${r.avgHintsPerQ.toFixed(2)}/q` : "");
                return (
                    <a key={i} href={href} title={title} className={styles.chip}>
                        {r.concept} — {r.subTopic}
                    </a>
                );
            })}
        </div>
    );
}

export default memo(RecommendedChipsImpl);
