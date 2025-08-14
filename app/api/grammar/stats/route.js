import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
