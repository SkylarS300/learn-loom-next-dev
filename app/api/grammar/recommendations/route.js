import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bank from "@/src/grammar/buildQuiz"; // default export is the question bank object

// -------- utils --------

// Recency weight: linear fade to 0.6 over 30 days
function recencyWeight(days) {
    const w = 1 - Math.min(days / 30, 1) * 0.4;
    return Math.max(0.6, w);
}

// FNV-1a hash (deterministic, fast) → unsigned 32-bit int
function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0);
}

// Flatten bank into [{concept, subTopic}]
function flattenBank(b) {
    if (!b || typeof b !== "object") return [];
    const out = [];
    for (const concept of Object.keys(b)) {
        const subs = b[concept] ? Object.keys(b[concept]) : [];
        for (const subTopic of subs) out.push({ concept, subTopic });
    }
    return out;
}

// Pick K stable "random" starters from bank using anonId
function pickStartersStable(anonId, k = 2) {
    const pairs = flattenBank(bank);
    if (!pairs.length) return [];
    const H = hash32(String(anonId) || "seed");
    const picks = new Set();
    const out = [];
    let i = 0;
    while (out.length < Math.min(k, pairs.length) && i < pairs.length * 3) {
        // two different steps to avoid obvious collisions
        const idx = (H + i * 7) % pairs.length;
        const idx2 = (H * 2654435761 + i) % pairs.length; // Knuth's multiplicative hash
        const choice = pairs[(idx + idx2) % pairs.length];
        const key = `${choice.concept}|${choice.subTopic}`;
        if (!picks.has(key)) {
            picks.add(key);
            out.push(choice);
        }
        i++;
    }
    return out;
}

// -------- route --------

export async function GET(req) {
    const cookieStore = cookies();
    const anonId = cookieStore.get("learnloomId")?.value;

    if (!anonId) {
        return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
    }

    // how many recommendations? default 2
    const { searchParams } = new URL(req.url);
    const n = Math.max(1, Math.min(5, Number(searchParams.get("n")) || 2));

    try {
        const rows = await prisma.grammarprogress.findMany({
            where: { anonId },
            orderBy: { createdAt: "desc" },
            take: 200, // last 200 attempts
            select: { concept: true, subTopic: true, score: true, createdAt: true },
        });

        // If there's no history, propose stable starters from the bank
        if (rows.length === 0) {
            const starters = pickStartersStable(anonId, n).map(({ concept, subTopic }) => ({
                concept,
                subTopic: subTopic || "General",
                attempts: 0,
                accuracy: null,           // unknown
                weightedAccuracy: null,   // unknown
                confidence: 0,            // none yet
                weakness: 1,              // surface near top
                recentScore: null,
                lastAttemptAt: null,
            }));

            return Response.json({ ok: true, data: starters });
        }

        const now = Date.now();
        const buckets = new Map(); // key => aggregate

        for (const r of rows) {
            const key = `${r.concept}|${r.subTopic || "General"}`;
            const days = (now - new Date(r.createdAt).getTime()) / 86400000;
            const w = recencyWeight(days);

            const b =
                buckets.get(key) ||
                {
                    concept: r.concept,
                    subTopic: r.subTopic || "General",
                    attempts: 0,
                    correct: 0,     // count attempts with score >= 0.8
                    wCorrect: 0,    // weighted sum of scores
                    wTotal: 0,      // total weight
                    lastAttemptAt: null,
                };

            b.attempts += 1;

            // normalize to 0..1 whether stored as 0..100 or 0..1
            const s = r.score > 1 ? r.score / 100 : r.score;
            b.correct += s >= 0.8 ? 1 : 0;
            b.wCorrect += s * w;
            b.wTotal += w;
            if (!b.lastAttemptAt || new Date(r.createdAt) > new Date(b.lastAttemptAt)) {
                b.lastAttemptAt = r.createdAt;
            }

            buckets.set(key, b);
        }

        const data = Array.from(buckets.values()).map((b) => {
            const accuracy = b.correct / Math.max(1, b.attempts); // unweighted accuracy
            const weightedAccuracy = b.wCorrect / Math.max(1e-6, b.wTotal); // 30-day weighted
            const confidence = Math.min(1, Math.sqrt(b.attempts) / 5);       // 25 attempts → ~1.0
            const weakness = (1 - weightedAccuracy) * (0.5 + 0.5 * confidence);

            return {
                ...b,
                accuracy,
                weightedAccuracy,
                weakness,
                confidence,
                recentScore: weightedAccuracy, // alias for clarity in UI
            };
        });

        // Rank by weakness; return top n with >=1 attempt
        let top = data
            .filter((x) => x.attempts >= 1)
            .sort((a, b) => b.weakness - a.weakness)
            .slice(0, n);

        // Fallback: if no computed top (should be rare), surface the very last practiced item
        if (top.length === 0 && rows.length > 0) {
            const last = rows[0];
            const s = last.score > 1 ? last.score / 100 : last.score;
            top = [
                {
                    concept: last.concept,
                    subTopic: last.subTopic || "General",
                    attempts: 1,
                    accuracy: s >= 0.8 ? 1 : 0,
                    weightedAccuracy: s,
                    recentScore: s,
                    confidence: Math.min(1, Math.sqrt(1) / 5),
                    weakness: 1 - s,
                    lastAttemptAt: last.createdAt,
                },
            ];
        }

        return Response.json({ ok: true, data: top });
    } catch (e) {
        console.error("recommendations GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
