import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

function dayKeyUTC(d) {
    // YYYY-MM-DD (UTC)
    return new Date(d).toISOString().slice(0, 10);
}
function rangeDaysUTC(days) {
    const out = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - i,
            0, 0, 0, 0
        ));
        out.push(dayKeyUTC(d));
    }
    return out;
}

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
    const start = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - (days - 1),
        0, 0, 0, 0
    ));

    try {
        // Pull raw rows within window; aggregate in JS so we can date-bucket
        const [reading, grammar] = await Promise.all([
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
        ]);

        // Reading: sum ms per day
        const readMap = new Map();
        for (const r of reading) {
            const key = dayKeyUTC(r.updatedAt);
            readMap.set(key, (readMap.get(key) || 0) + (r.timeMs || 0));
        }

        // Grammar: average score per day
        const gramMap = new Map(); // key -> {sum, count}
        for (const g of grammar) {
            const key = dayKeyUTC(g.createdAt);
            const prev = gramMap.get(key) || { sum: 0, count: 0 };
            prev.sum += g.score || 0;
            prev.count += 1;
            gramMap.set(key, prev);
        }

        // Build contiguous series (fill zeros)
        const daysKeys = rangeDaysUTC(days);
        const readingDaily = daysKeys.map((k) => ({
            date: k,
            minutes: Math.round(((readMap.get(k) || 0) / 60000) * 10) / 10, // one decimal
        }));
        const grammarDaily = daysKeys.map((k) => {
            const s = gramMap.get(k);
            return {
                date: k,
                avg: s ? Math.round((s.sum / s.count) * 10) / 10 : 0,
            };
        });

        return Response.json({ ok: true, data: { readingDaily, grammarDaily } });
    } catch (e) {
        console.error("metrics GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
