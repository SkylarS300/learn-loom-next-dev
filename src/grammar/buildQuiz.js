import bank from "./bank/index";

// Fisher–Yates shuffle (pure)
function shuffle(arr, seed = null) {
    const a = arr.slice();
    let rand = () => Math.random();
    if (typeof seed === "number") {
        // simple LCG for deterministic shuffles
        let s = seed >>> 0;
        rand = () => ((s = (1664525 * s + 1013904223) >>> 0) / 0xffffffff);
    }
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/**
 * Build a quiz from the bank.
 * @param {Object} opts
 * @param {string} opts.concept
 * @param {string} opts.subTopic
 * @param {"easy"|"medium"|"hard"|"mixed"} [opts.difficulty="mixed"]
 * @param {number} [opts.count=10]
 * @param {number} [opts.seed]  // optional deterministic selection
 * @param {boolean} [opts.allowShort=false] // include short-response items
 * @returns {{ concept, subTopic, items: Array }}
 */
export function buildQuiz({
    concept,
    subTopic,
    difficulty = "mixed",
    count = 10,
    seed = null,
    allowShort = false,
}) {
    const node = bank?.[concept]?.[subTopic];
    if (!node) {
        return { concept, subTopic, items: [] };
    }

    let pool = [];
    if (difficulty === "mixed") {
        pool = node.pool.slice();
    } else {
        pool = (node[difficulty] || []).slice();
    }

    // Include dynamic generator output if available and pool is small
    if (typeof node.gen === "function") {
        const need = Math.max(0, count - pool.length);
        if (need > 0) {
            const generated = node.gen(need);
            pool.push(...generated);
            node.pool.push(...generated);
            node[difficulty === "mixed" ? "easy" : difficulty].push(...generated); // default bucket
        }
    }

    // Filter by kind unless allowShort
    if (!allowShort) pool = pool.filter((q) => q.kind !== "short");

    const items = shuffle(pool, seed).slice(0, count);
    // Normalize choice order with optional deterministic shuffle per question
    const normalized = items.map((q, i) => {
        if (q.kind !== "mcq" || !Array.isArray(q.choices)) return q;
        // keep choices order stable for now; could add per-item shuffling later
        return q;
    });
    return { concept, subTopic, items: normalized };
}

export default bank;
