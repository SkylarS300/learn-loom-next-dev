// app/api/define/route.js
import { z } from "zod";

// Minimal local dictionary (swap later for a real source)
const DICT = {
    "universally": {
        defs: ["In a way that applies to all cases; generally."],
        example: "It is a truth universally acknowledged...",
        phonetic: "ˌjuːnɪˈvɜː(r)səli",
    },
    "acknowledged": {
        defs: ["Recognized as being good or important.", "Admitted to be true."],
        example: "It is a truth universally acknowledged...",
        phonetic: "əkˈnɒlɪdʒd",
    },
    "possession": {
        defs: ["The state of having, owning, or controlling something."],
        example: "A single man in possession of a good fortune...",
        phonetic: "pəˈzɛʃ(ə)n",
    },
    "fortune": {
        defs: ["A large amount of money or assets."],
        example: "A single man in possession of a good fortune...",
        phonetic: "ˈfɔːtʃuːn",
    },
    "neighbourhood": {
        defs: ["A district, especially one forming a community within a town or city."],
        example: "On his first entering a neighbourhood...",
        phonetic: "ˈneɪbəhʊd",
    },
    // add a few more common words as you wish…
};

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const Schema = z.object({ term: z.string().trim().min(1).max(64) });
    const parsed = Schema.safeParse({ term: searchParams.get("term") || "" });
    if (!parsed.success) {
        return Response.json({ ok: false, error: "Missing term" }, { status: 400 });
    }
    const raw = parsed.data.term.toLowerCase();
    const key = raw.replace(/[^a-z'-]/g, "");
    const hit = DICT[key];

    // Always respond OK (so UI can show "no definition found" gracefully)
    return Response.json({
        ok: true,
        data: hit
            ? { lemma: key, defs: hit.defs, example: hit.example, phonetic: hit.phonetic }
            : { lemma: key, defs: [], example: "" },
    }, {
        headers: { "Cache-Control": "public, max-age=120, s-maxage=120" },
    });
}

// --- NEW: POST for richer definition via model, with graceful fallback to DICT ---
async function defineViaOpenAI(term) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const prompt =
        `Give a simple learner-friendly English definition and one short example sentence for the word: "${term}". ` +
        `Return strict JSON with keys: definition, example.`;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        })
    });
    const j = await r.json().catch(() => ({}));
    const raw = j?.choices?.[0]?.message?.content || "{}";
    try {
        const obj = JSON.parse(raw);
        if (obj && (obj.definition || obj.example)) return obj;
    } catch { /* fall through */ }
    return null;
}

export async function POST(req) {
    const Body = z.object({ word: z.string().trim().min(1).max(64).optional(), term: z.string().trim().min(1).max(64).optional() });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return Response.json({ ok: false, error: "Missing word" }, { status: 400 });
    }
    const raw = (parsed.data.word || parsed.data.term || "").toLowerCase();
    const key = raw.replace(/[^a-z'-]/g, "");

    // 1) Try model-backed definition (if configured)
    try {
        const ai = await defineViaOpenAI(key);
        if (ai) {
            return Response.json({
                ok: true,
                definition: String(ai.definition || ""),
                example: String(ai.example || "")
            }, { headers: { "Cache-Control": "no-store" } });
        }
    } catch { /* ignore and fall back */ }

    // 2) Fallback: local mini-dictionary (always OK)
    const hit = DICT[key];
    return Response.json({
        ok: true,
        definition: hit?.defs?.[0] || "",
        example: hit?.example || ""
    }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}


export const dynamic = "force-dynamic";
