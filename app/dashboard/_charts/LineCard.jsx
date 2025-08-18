// app/dashboard/_charts/LineCard.jsx
"use client";

import { memo, useEffect } from "react";
import { track } from "@/lib/rum";
import styles from "../Dashboard.module.css";
import {
    ResponsiveContainer,
    LineChart, Line,
    CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";

function LineCardImpl({ title, data, xKey = "date", yKey, yDomain, yAxisWidth = 40 }) {
    useEffect(() => {
        track("chart_rendered", {
            title,
            ms_from_mount: Math.round(performance.now() - (window.__dashStart || 0)),
            points: Array.isArray(data) ? data.length : 0,
        });
    }, [title]);
    return (
        <div className={styles.card}>
            <h4 className={styles.h4}>{title}</h4>
            <div className={styles.chart}>
                <ResponsiveContainer>
                    <LineChart data={data || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
                        <YAxis width={yAxisWidth} domain={yDomain ?? ["auto", "auto"]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey={yKey} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default memo(LineCardImpl);
