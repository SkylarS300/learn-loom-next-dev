import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

// ----- helpers -----
function dayKeyUTC(d) {
    // YYYY-MM-DD (UTC)
    return new Date(d).toISOString().slice(0, 10);
}
function rangeDaysUTC(days) {
    const out = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - i,
                0, 0, 0, 0
            )
        );
        out.push(dayKeyUTC(d));
    }
    return out;
}

// Recency weight: linear fade to 0.6 over 30 days
function recencyWeight(days) {
    const w = 1 - Math.min(days / 30, 1) * 0.4;
    return Math.max(0.6, w);
}

// Map seconds-per-question to a speed efficiency [0.5..1.0]
// Baseline 15s/q: 1.0; slower → down to 0.5; faster capped at 1.0
function speedEfficiency(secPerQ) {
    if (!Number.isFinite(secPerQ) || secPerQ <= 0) return 1.0;
    const baseline = 15;
    return Math.max(0.5, Math.min(1.0, baseline / secPerQ));
}

// ----- handler -----
export async function GET(req) {
    const url = new URL(req.url);
    const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days") || 7)));

    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) {
        return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
    }

    // Start-of-day (UTC) N days ago
    const today = new Date();
    const start = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() - (days - 1),
            0, 0, 0, 0
        )
    );

    try {
        // Pull raw rows within window; aggregate in JS so we can date-bucket
        const [reading, grammar, grammarForPace] = await Promise.all([
            prisma.readingprogress.findMany({
                where: { anonId, updatedAt: { gte: start } },
                select: { timeMs: true, updatedAt: true },
                orderBy: { updatedAt: "asc" },
            }),
            prisma.grammarprogress.findMany({
                where: { anonId, createdAt: { gte: start } },
                select: { score: true, createdAt: true },
                orderBy: { createdAt: "asc" },
            }),
            // pace ignores AI attempts
            prisma.grammarprogress.findMany({
                where: {
                    anonId,
                    createdAt: { gte: start },
                    OR: [{ isAi: false }, { isAi: null }],
                },
                select: { numQuestions: true, durationMs: true, createdAt: true },
                orderBy: { createdAt: "asc" },
            }),
        ]);

        // Reading: sum ms per day -> minutes (1 decimal)
        const readMap = new Map();
        for (const r of reading) {
            const key = dayKeyUTC(r.updatedAt);
            readMap.set(key, (readMap.get(key) || 0) + (r.timeMs || 0));
        }

        // Grammar: average score per day (0..100)
        const gramMap = new Map(); // key -> {sum, count}
        for (const g of grammar) {
            const key = dayKeyUTC(g.createdAt);
            const prev = gramMap.get(key) || { sum: 0, count: 0 };
            prev.sum += Number(g.score || 0);
            prev.count += 1;
            gramMap.set(key, prev);
        }

        // Grammar pace: average seconds/question per day (ignoring AI)
        const paceMap = new Map(); // key -> {secSum, qSum}
        for (const g of grammarForPace) {
            const key = dayKeyUTC(g.createdAt);
            const n = Number.isFinite(g.numQuestions) && g.numQuestions > 0 ? g.numQuestions : 0;
            const s = Number.isFinite(g.durationMs) && g.durationMs > 0 ? g.durationMs / 1000 : 0;
            if (!paceMap.has(key)) paceMap.set(key, { secSum: 0, qSum: 0 });
            if (n > 0 && s > 0) {
                const v = paceMap.get(key);
                v.secSum += s;
                v.qSum += n;
            }
        }

        // Build contiguous series (fill zeros)
        const daysKeys = rangeDaysUTC(days);

        const readingDaily = daysKeys.map((k) => ({
            date: k,
            minutes: Math.round(((readMap.get(k) || 0) / 60000) * 10) / 10,
        }));

        const grammarDaily = daysKeys.map((k) => {
            const s = gramMap.get(k);
            return {
                date: k,
                avg: s ? Math.round((s.sum / s.count) * 10) / 10 : 0,
            };
        });

        const grammarPaceDaily = daysKeys.map((k) => {
            const v = paceMap.get(k);
            const secPerQ = v && v.qSum > 0 ? +(v.secSum / v.qSum).toFixed(2) : null;
            return { date: k, secPerQ };
        });

        // ---- Insights: top weak areas (exclude AI, use speed + recency) ----
        const last200 = await prisma.grammarprogress.findMany({
            where: { anonId, OR: [{ isAi: false }, { isAi: null }] },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: { concept: true, subTopic: true, score: true, numQuestions: true, durationMs: true, createdAt: true },
        });

        const now = Date.now();
        const buckets = new Map();
        for (const r of last200) {
            const key = `${r.concept}|${r.subTopic || "General"}`;
            const daysOld = (now - r.createdAt.getTime()) / 86400000;
            const w = recencyWeight(daysOld);
            const s = (r.score > 1 ? r.score / 100 : r.score) || 0;
            const n = Number.isFinite(r.numQuestions) && r.numQuestions > 0 ? r.numQuestions : 10;
            const spq = (Number.isFinite(r.durationMs) ? r.durationMs : 0) / 1000 / Math.max(1, n);
            const eff = speedEfficiency(spq);
            const b = buckets.get(key) || { concept: r.concept, subTopic: r.subTopic || "General", attempts: 0, wAcc: 0, w: 0 };
            b.attempts += 1;
            b.wAcc += s * eff * w;
            b.w += w;
            buckets.set(key, b);
        }
        const topWeakAreas = Array.from(buckets.values())
            .map((b) => {
                const wa = b.w > 0 ? b.wAcc / b.w : 0;
                return { ...b, weightedAccuracy: wa, weakness: 1 - wa };
            })
            .sort((a, b) => b.weakness - a.weakness)
            .slice(0, 3);

        return Response.json({
            ok: true,
            data: { readingDaily, grammarDaily, grammarPaceDaily, topWeakAreas },
        });
    } catch (e) {
        console.error("metrics GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
