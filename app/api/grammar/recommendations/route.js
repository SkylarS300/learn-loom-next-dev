import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Recency weight: linear fade to 0.6 over 30 days
function recencyWeight(days) {
    const w = 1 - Math.min(days / 30, 1) * 0.4;
    return Math.max(0.6, w);
}

export async function GET() {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) {
        return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
    }
    try {
        const rows = await prisma.grammarprogress.findMany({
            where: { anonId },
            orderBy: { createdAt: "desc" },
            take: 200, // last 200 attempts
            select: { concept: true, subTopic: true, score: true, createdAt: true },
        });
        const now = Date.now();
        const buckets = new Map(); // key = `${concept}|${sub}`, value = { attempts, correct, wCorrect, wTotal }
        for (const r of rows) {
            const key = `${r.concept}|${r.subTopic || "General"}`;
            const days = (now - new Date(r.createdAt).getTime()) / 86400000;
            const w = recencyWeight(days);
            const b = buckets.get(key) || { concept: r.concept, subTopic: r.subTopic || "General", attempts: 0, correct: 0, wCorrect: 0, wTotal: 0 };
            b.attempts += 1;
            b.correct += r.score >= 0.8 ? 1 : 0; // assume score is 0..1 OR 0..100; normalize below
            b.wCorrect += (r.score > 1 ? r.score / 100 : r.score) * w;
            b.wTotal += w;
            buckets.set(key, b);
        }
        const data = Array.from(buckets.values()).map((b) => {
            const accuracy = b.correct / Math.max(1, b.attempts);
            const weightedAccuracy = b.wCorrect / Math.max(1e-6, b.wTotal);
            const confidence = Math.min(1, Math.sqrt(b.attempts) / 5); // 25 attempts => ~1.0
            const weakness = (1 - weightedAccuracy) * (0.5 + 0.5 * confidence);
            return { ...b, accuracy, weightedAccuracy, weakness };
        });
        // Only show meaningful areas
        const top = data
            .filter((x) => x.attempts >= 5)
            .sort((a, b) => b.weakness - a.weakness)
            .slice(0, 2);
        return Response.json({ ok: true, data: top });
    } catch (e) {
        console.error("recommendations GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
