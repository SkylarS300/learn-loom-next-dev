// Builds a normalized bank from your existing src/content/quizzes.js
// Non-breaking: we don’t modify the legacy file or its shape.
import legacy from "@/src/content/quizzes.js";

// Normalize one legacy question into a common shape
function normalizeQ(q, idx, concept, subTopic) {
    const id = q.id || `${concept}:${subTopic}:${idx}`;
    const kind = q.type === "short-response" ? "short" : "mcq";
    return {
        id,
        kind,                             // "mcq" | "short"
        prompt: q.question || q.prompt || "",
        choices: Array.isArray(q.choices) ? q.choices : [],
        answerIndex:
            typeof q.correctAnswer === "number"
                ? q.correctAnswer
                : typeof q.answerIndex === "number"
                    ? q.answerIndex
                    : undefined,
        answerText: q.answerText || undefined,
        explanation: q.explanation || "",
        // Optional metadata passthrough
        meta: q.meta || {},
    };
}

// Try to infer a difficulty if you didn’t label one
function inferDifficulty(q) {
    if (q.meta?.difficulty) return q.meta.difficulty; // "easy" | "medium" | "hard"
    // Heuristic: more choices ⇒ harder; short-response ⇒ medium+
    if (q.kind === "short") return "medium";
    const n = (q.choices || []).length;
    if (n <= 3) return "easy";
    if (n === 4) return "medium";
    return "hard";
}

export default function buildBankFromStatic() {
    const bank = {}; // { [concept]: { [subTopic]: { easy:[], medium:[], hard:[], pool:[] } } }
    const concepts = legacy || {};
    for (const conceptKey of Object.keys(concepts)) {
        const node = concepts[conceptKey] || {};
        const subList = Array.isArray(node.subConcepts) ? node.subConcepts : [];
        for (const sub of subList) {
            const subTopic = sub.subConcept || sub.subTopic || "General";
            const list = Array.isArray(sub.questions) ? sub.questions : [];
            for (let i = 0; i < list.length; i++) {
                const qN = normalizeQ(list[i], i, conceptKey, subTopic);
                const diff = inferDifficulty(qN);
                bank[conceptKey] = bank[conceptKey] || {};
                bank[conceptKey][subTopic] = bank[conceptKey][subTopic] || {
                    easy: [],
                    medium: [],
                    hard: [],
                    pool: [],
                };
                bank[conceptKey][subTopic][diff].push(qN);
                bank[conceptKey][subTopic].pool.push(qN);
            }
        }
    }
    return bank;
}
