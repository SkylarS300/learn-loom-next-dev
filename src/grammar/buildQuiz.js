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

// Ensure a topic node always has expected buckets (non-destructive init)
function ensureBuckets(node) {
    if (!node.pool) node.pool = [];
    if (!node.easy) node.easy = [];
    if (!node.medium) node.medium = [];
    if (!node.hard) node.hard = [];
    return node;
}


// ---- Local miss history (client-only, privacy-first) ----
const MISS_KEY = "grammarMistakesV1";
function loadMistakes() {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(MISS_KEY);
        if (!raw) return [];
        const map = JSON.parse(raw);
        // map shape: { "concept|subTopic|prompt": { count, last } }
        return Object.entries(map).map(([k, v]) => {
            const [concept, subTopic, ...rest] = k.split("|");
            const prompt = rest.join("|"); // prompt may include |
            return { concept, subTopic, prompt, count: v?.count ?? 1, last: v?.last ?? 0 };
        });
    } catch { return []; }
}

function pickWeakFromPool(pool, concept, subTopic, wantN) {
    if (!wantN || wantN <= 0) return [];
    const mistakes = loadMistakes()
        .filter(m => m.concept === concept && m.subTopic === subTopic)
        .sort((a, b) => (b.count - a.count) || (b.last - a.last));
    const chosen = [];
    const usedIdx = new Set();
    for (const m of mistakes) {
        // match by exact prompt
        for (let i = 0; i < pool.length; i++) {
            if (usedIdx.has(i)) continue;
            if ((pool[i].prompt || "") === m.prompt) {
                chosen.push({ item: pool[i], idx: i });
                usedIdx.add(i);
                break;
            }
        }
        if (chosen.length >= wantN) break;
    }
    return chosen;
}


// Deterministically shuffle choices and remap the correct answer index
function shuffleChoices(q, seedBase) {
    if (!q || q.kind !== "mcq" || !Array.isArray(q.choices)) return q;
    const idxs = q.choices.map((_, i) => i);
    const perm = shuffle(idxs, seedBase);
    const choices = perm.map((pi) => q.choices[pi]);
    const answerIndex = perm.indexOf(q.answerIndex);
    return { ...q, choices, answerIndex };
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

function uniqueBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    for (const it of arr || []) {
        const k = keyFn(it);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(it);
    }
    return out;
}

// Basic MCQ sanity: 2–6 choices, valid answerIndex
function sanitizeMCQ(q) {
    if (!q || q.kind !== "mcq") return null;
    const choices = Array.isArray(q.choices) ? q.choices.map(String) : [];
    if (choices.length < 2 || choices.length > 6) return null;
    let answerIndex = Number(q.answerIndex);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) return null;
    const prompt = String(q.prompt || "").trim();
    if (!prompt) return null;
    const explanation = q.explanation ? String(q.explanation).trim() : undefined;
    return { kind: "mcq", prompt, choices, answerIndex, ...(explanation ? { explanation } : {}) };
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
    let node = bank?.[concept]?.[subTopic]; if (!node) {
        return { concept, subTopic, items: [] };
    }
    node = ensureBuckets(node);

    // Normalize inputs
    count = Math.max(1, Math.min(30, Number(count) || 10));
    if (seed != null && !Number.isFinite(seed)) seed = null;

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
            const safeGen = (generated || [])
                .map(sanitizeMCQ)
                .filter(Boolean);
            pool.push(...safeGen);
            // Also keep bank caches updated for future sessions
            node.pool.push(...safeGen);
            const bucketName = (difficulty === "mixed" ? "easy" : difficulty);
            node[bucketName].push(...safeGen);
        }
    }

    // Filter by kind unless allowShort and sanitize
    pool = (pool || [])
        .filter(q => allowShort ? true : q.kind !== "short")
        .map(sanitizeMCQ)
        .filter(Boolean);

    // Dedupe by prompt (case-insensitive) to reduce repeats
    pool = uniqueBy(pool, q => (q.prompt || "").trim().toLowerCase());

    // --- Smart bias: pull ~40% from recent misses (if available) ---
    const targetWeak = Math.max(1, Math.floor(count * 0.4));
    const weak = pickWeakFromPool(pool, concept, subTopic, targetWeak);
    const weakIdx = new Set(weak.map(w => w.idx));
    const remainder = [];
    for (let i = 0; i < pool.length; i++) {
        if (!weakIdx.has(i)) remainder.push(pool[i]);
    }
    const remainderPick = shuffle(remainder, seed).slice(0, Math.max(0, count - weak.length));
    const items = [...weak.map(w => w.item), ...remainderPick].slice(0, count);
    if (!items.length) return { concept, subTopic, items: [] };
    // First fix obvious a/an mistakes, then deterministically shuffle choices
    const normalized = items.map((q, i) =>
        shuffleChoices(
            fixArticleAnswer(q),
            seed == null ? (i + 1) : (seed + i + 1)
        ));

    return { concept, subTopic, items: normalized };
}

export default bank;
