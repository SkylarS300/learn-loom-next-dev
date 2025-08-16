import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // --- NEW: recent mode for mini-card ---
    try {
        const url = new URL(req.url);
        if (url.searchParams.get("recent") === "1") {
            const limit = Math.min(Number(url.searchParams.get("limit") ?? 60), 200);
            const sinceDays = Number(url.searchParams.get("days") ?? 45);
            const since = new Date();
            since.setDate(since.getDate() - sinceDays);

            const recent = await prisma.grammarprogress.findMany({
                where: { anonId, isAi: { not: true }, createdAt: { gte: since } },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: { concept: true, subTopic: true, score: true, createdAt: true },
            });

            // Build series per subtopic (oldest → newest for charts)
            const byKey = new Map();
            for (let i = recent.length - 1; i >= 0; i--) {
                const r = recent[i];
                const k = `${r.concept}:::${r.subTopic}`;
                if (!byKey.has(k)) byKey.set(k, { concept: r.concept, subTopic: r.subTopic, series: [] });
                byKey.get(k).series.push({ t: r.createdAt.toISOString(), score: r.score });
            }

            // Find most recent timestamp per subtopic
            const latest = new Map();
            for (const r of recent) {
                const k = `${r.concept}:::${r.subTopic}`;
                const at = r.createdAt.getTime();
                const prev = latest.get(k);
                if (!prev || at > prev.lastAt) latest.set(k, { concept: r.concept, subTopic: r.subTopic, lastAt: at });
            }

            const topThree = Array.from(latest.values())
                .sort((a, b) => b.lastAt - a.lastAt)
                .slice(0, 3)
                .map(({ concept, subTopic }) => {
                    const k = `${concept}:::${subTopic}`;
                    const entry = byKey.get(k) ?? { series: [] };
                    const last3 = entry.series.slice(-3).map(d => d.score);
                    const latestScore = last3.length ? last3[last3.length - 1] : null;
                    return { concept, subTopic, latestScore, last3, series: entry.series };
                });

            // Optional: return ALL recent subtopics (for the “Show more” modal)
            if (url.searchParams.get("all") === "1") {
                const all = Array.from(latest.values())
                    .sort((a, b) => b.lastAt - a.lastAt)
                    .map(({ concept, subTopic }) => {
                        const k = `${concept}:::${subTopic}`;
                        const entry = byKey.get(k) ?? { series: [] };
                        const last3 = entry.series.slice(-3).map(d => d.score);
                        const latestScore = last3.length ? last3[last3.length - 1] : null;
                        return { concept, subTopic, latestScore, last3, series: entry.series };
                    });
                return Response.json({ ok: true, data: { topThree: all.slice(0, 3), all } });
            }

            return Response.json({ ok: true, data: { topThree } });
        }
    } catch (e) {
        // If URL parsing fails, fall through to default aggregation
    }


    try {
        // Prefer groupBy; if your Prisma doesn't support where in groupBy, we can fallback to JS
        const rows = await prisma.grammarprogress.groupBy({
            by: ["concept", "subTopic"],
            where: { anonId, isAi: { not: true } },
            _count: { _all: true },
            _avg: { score: true },
            _max: { createdAt: true },
        });

        const data = rows.map(r => ({
            concept: r.concept,
            subTopic: r.subTopic,
            attempts: r._count?._all || 0,
            avgScore: Math.round((r._avg?.score || 0) * 10) / 10,
            lastAt: r._max?.createdAt || null,
        }));

        return Response.json({ ok: true, data });
    } catch (e) {
        console.error("grammar/stats GET failed:", e);
        // Fallback aggregation in JS if needed
        try {
            const rows = await prisma.grammarprogress.findMany({
                where: { anonId, isAi: { not: true } },
                select: { concept: true, subTopic: true, score: true, createdAt: true },
            });
            const map = new Map();
            for (const r of rows) {
                const k = `${r.concept}|${r.subTopic}`;
                const cur = map.get(k) || { concept: r.concept, subTopic: r.subTopic, attempts: 0, sum: 0, lastAt: null };
                cur.attempts += 1;
                cur.sum += r.score || 0;
                if (!cur.lastAt || r.createdAt > cur.lastAt) cur.lastAt = r.createdAt;
                map.set(k, cur);
            }
            const data = [...map.values()].map(v => ({
                concept: v.concept,
                subTopic: v.subTopic,
                attempts: v.attempts,
                avgScore: v.attempts ? Math.round((v.sum / v.attempts) * 10) / 10 : 0,
                lastAt: v.lastAt,
            }));
            return Response.json({ ok: true, data });
        } catch (err) {
            console.error("grammar/stats fallback failed:", err);
            return Response.json({ ok: false, error: "Server error" }, { status: 500 });
        }
    }
}
