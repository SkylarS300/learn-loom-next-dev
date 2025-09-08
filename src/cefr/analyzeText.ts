//src/cefr/analyzeText.ts
import seed from "@/src/data/cefr-words.json";
import { toLemma } from "@/app/readingpal/word-utils";

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const map: Record<string, Level> = Object.create(null);
for (const [lvl, words] of Object.entries(seed as Record<Level, string[]>)) {
    for (const w of words) map[w] = lvl as Level;
}

export function wordLevel(w: string): Level | "" {
    const lemma = toLemma(w);
    return (map[lemma] as Level) || "";
}

export function analyzeCEFR(text: string) {
    const tokens = (text.match(/[A-Za-z']+/g) || []).map(t => t.toLowerCase());
    const levels = tokens.map(t => wordLevel(t) || "C2");
    const tallies: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    for (const l of levels) tallies[l as Level] = (tallies[l as Level] || 0) + 1;
    return { tallies, tokens, levels };
}
