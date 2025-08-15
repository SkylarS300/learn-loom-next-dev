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
    const cookieStore = await cookies(); // await before using
    const anonId = cookieStore.get("learnloomId")?.value;
    const { searchParams } = new URL(req.url);

    // Map seconds-per-question to a speed efficiency [0.5..1.0]
    // Baseline 15s/q: 1.0; slower → down to 0.5; faster capped at 1.0
    // Baseline and knobs are tunable via query:
    //  - paceBaseline (default 15)
    function speedEfficiency(secPerQ) {
        if (!Number.isFinite(secPerQ) || secPerQ <= 0) return 1.0;
        const baseline = Math.max(1, Number(searchParams.get("paceBaseline")) || 15);
        return Math.max(0.5, Math.min(1.0, baseline / secPerQ));
    }

    if (!anonId) {
        return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
    }

    // how many recommendations? default 2
    const n = Math.max(1, Math.min(5, Number(searchParams.get("n")) || 2));
    // minimum attempts before full trust (penalize sparse topics a bit)
    const minAttempts = Math.max(1, Number(searchParams.get("minAttempts")) || 3);
    // weights/knobs (exposed for experiments)
    const alphaHints = Math.max(0, Math.min(0.15, Number(searchParams.get("alphaHints")) || 0.12));
    const alphaPace = Math.max(0, Math.min(0.30, Number(searchParams.get("alphaPace")) || 0.15));


    try {
        const rows = await prisma.grammarprogress.findMany({
            where: {
                anonId,
                OR: [{ isAi: false }, { isAi: null }], // exclude AI by default
            },
            orderBy: { createdAt: "desc" },
            take: 200, // last 200 attempts
            select: {
                concept: true,
                subTopic: true,
                score: true,
                numQuestions: true,
                durationMs: true,
                hintsUsed: true,
                createdAt: true,
            },
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
        // key = `${concept}|${sub}`, value aggregate container
        const buckets = new Map();
        for (const r of rows) {
            const key = `${r.concept}|${r.subTopic || "General"}`;
            const days = (now - new Date(r.createdAt).getTime()) / 86400000;
            const w = recencyWeight(days);

            const b = buckets.get(key) || {
                concept: r.concept,
                subTopic: r.subTopic || "General",
                attempts: 0,
                correct: 0,
                wCorrect: 0,   // accuracy * speed * recency
                wTotal: 0,     // recency
                wSec: 0,       // for avg seconds per question (weighted by recency)
                wN: 0,
                wHints: 0,     // weighted hints per question
                wHintsN: 0,    // weighted count for hints
                daySet: new Set(), // for streaks
            };
            // normalize score to 0..1
            const s = (r.score > 1 ? r.score / 100 : r.score) || 0;
            const n = Number.isFinite(r.numQuestions) && r.numQuestions > 0 ? r.numQuestions : 10; const secPerQ = (Number.isFinite(r.durationMs) ? r.durationMs : 0) / 1000 / Math.max(1, n);
            const eff = speedEfficiency(secPerQ); // [0.5..1.0]
            const hints = Number.isFinite(r.hintsUsed) ? Math.max(0, r.hintsUsed) : 0;
            const hintsPerQ = n > 0 ? (hints / n) : 0;
            b.attempts += 1;
            b.correct += s >= 0.8 ? 1 : 0;
            // fold speed into accuracy before aggregating
            b.wCorrect += s * eff * w;
            b.wTotal += w;
            // track pace (weighted)
            if (Number.isFinite(secPerQ) && secPerQ > 0) {
                b.wSec += secPerQ * w;
                b.wN += w;
            }
            // track hints (weighted)
            if (hintsPerQ > 0) {
                b.wHints += hintsPerQ * w;
                b.wHintsN += w;
            }
            // collect day keys for streaks
            const dayKey = Math.floor(new Date(r.createdAt).getTime() / 86400000); // epoch days
            b.daySet.add(dayKey);

            buckets.set(key, b);
        }

        const data = Array.from(buckets.values()).map((b) => {
            const accuracy = b.correct / Math.max(1, b.attempts);           // crude ratio on ≥80% hits
            const weightedAccuracy = b.wCorrect / Math.max(1e-6, b.wTotal); // already speed-adjusted
            const confidence = Math.min(1, Math.sqrt(b.attempts) / 5);      // 25 attempts → ~1.0
            const avgSecPerQ = b.wN > 0 ? b.wSec / b.wN : null;
            const avgHintsPerQ = (b.wHintsN > 0) ? (b.wHints / b.wHintsN) : 0;
            const efficiency = avgSecPerQ ? speedEfficiency(avgSecPerQ) : 1.0; // [0.5..1.0]
            // Base weakness from accuracy (0..1), then gently add speed penalty if slow
            let weakness = (1 - weightedAccuracy) * (0.5 + 0.5 * confidence);
            const paceBaseline = Math.max(1, Number(searchParams.get("paceBaseline")) || 15);
            if (avgSecPerQ && avgSecPerQ > paceBaseline) {
                // pace penalty scaled by alphaPace (kept gentle)
                const extra = Math.min(0.25, (avgSecPerQ - paceBaseline) / 60) * alphaPace;
                weakness = Math.min(1, weakness + extra);
            }
            // Hints penalty (small): scaled by alphaHints
            if (avgHintsPerQ > 0) {
                const extra = Math.min(0.15, avgHintsPerQ * alphaHints * 2);
                weakness = Math.min(1, weakness + extra);
            }
            // NEW: define attemptsPenalty (we referenced it below)
            const attemptsPenalty =
                b.attempts < minAttempts ? ((minAttempts - b.attempts) * 0.05) : 0;

            // Compute streak (consecutive days ending at most-recent attempt)
            let streakDays = 0;
            if (b.daySet && b.daySet.size) {
                const days = Array.from(b.daySet.values());
                let cur = Math.max(...days);
                while (b.daySet.has(cur)) { streakDays += 1; cur -= 1; }
            }
            // Penalize topics with too few attempts so they rank a bit lower than established weaknesses
            const rank = Math.max(0, weakness - attemptsPenalty); // higher rank = more recommended
            return { ...b, accuracy, weightedAccuracy, weakness, confidence, avgSecPerQ, efficiency, avgHintsPerQ, streakDays, rank };
        });

        // Show areas even with limited data (>=1 attempt). Confidence will be low.
        let top = data
            .filter((x) => x.attempts >= 1)
            .sort((a, b) => b.rank - a.rank)
            .slice(0, n);

        // Fallback: if no computed top (should be rare), surface the very last practiced item
        if (top.length === 0 && rows.length > 0) {
            const last = rows[0];
            const s = (last.score > 1 ? last.score / 100 : last.score) || 0;
            const n = Number.isFinite(last.numQuestions) && last.numQuestions > 0 ? last.numQuestions : 10;
            const spq = (Number.isFinite(last.durationMs) ? last.durationMs : 0) / 1000 / Math.max(1, n);
            const eff = speedEfficiency(spq);
            top = [{
                concept: last.concept,
                subTopic: last.subTopic || "General",
                attempts: 1,
                accuracy: s >= 0.8 ? 1 : 0,
                weightedAccuracy: s * eff,
                confidence: Math.min(1, Math.sqrt(1) / 5),
                avgSecPerQ: spq || null,
                efficiency: eff,
                weakness: Math.min(1, 1 - (s * eff)),
                rank: Math.min(1, 1 - (s * eff)), // fallback rank aligns with weakness
                avgHintsPerQ: 0,
                streakDays: 1,
                rank: Math.min(1, 1 - (s * eff)), // fallback rank aligns with weakness
            }];

            return Response.json({ ok: true, data: top });
        }

        return Response.json({ ok: true, data: top });
    } catch (e) {
        console.error("recommendations GET failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
