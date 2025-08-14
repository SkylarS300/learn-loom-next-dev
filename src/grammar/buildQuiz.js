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

// Heuristic: expected 'a' or 'an' for a single word following the blank
function expectedArticle(word) {
    const w = (word || "").toLowerCase();
    if (!w) return "a";
    // silent 'h'
    if (/^(honest|honor|honour|hour|heir)/.test(w)) return "an";
    // 'u' with /juː/ sound → a (university, unicorn, unique, user, useful...)
    if (/^(uni|unio|univ|u[snqltrmdfb])/.test(w)) return "a";
    // 'eu' /juː/ → a (european, eulogy, euphemism)
    if (/^(eu)/.test(w)) return "a";
    // 'one', 'once' → a (starts with /w/)
    if (/^(one|once)/.test(w)) return "a";
    // default: vowel letter → an; else a
    return /^[aeiou]/.test(w) ? "an" : "a";
}

function fixArticleAnswer(q) {
    if (!q || q.kind !== "mcq" || !Array.isArray(q.choices)) return q;
    if (!/___\s*\w+/.test(q.prompt || "")) return q;
    // Only act if both 'a' and 'an' are present
    const idxA = q.choices.findIndex(c => String(c).toLowerCase() === "a");
    const idxAn = q.choices.findIndex(c => String(c).toLowerCase() === "an");
    if (idxA === -1 || idxAn === -1) return q;
    const m = (q.prompt || "").match(/___\s*([A-Za-z-]+)/);
    if (!m) return q;
    const want = expectedArticle(m[1]);
    const wantIdx = want === "an" ? idxAn : idxA;
    if (q.answerIndex !== wantIdx) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[bank fix] adjusted a/an answerIndex for:", q.prompt);
        }
        return { ...q, answerIndex: wantIdx };
    }
    return q;
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
    // First fix obvious a/an mistakes, then deterministically shuffle choices
    const normalized = items.map((q, i) =>
        shuffleChoices(fixArticleAnswer(q), seed == null ? i + 1 : seed + i + 1)
    );
    return { concept, subTopic, items: normalized };
}

export default bank;
