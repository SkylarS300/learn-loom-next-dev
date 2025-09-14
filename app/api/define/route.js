// app/api/define/route.js
import { z } from "zod";

// Tiny seed dictionary (swap later for a real source)
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
};

function normalizeTerm(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z'-]/g, "");
}

function toPayload(key, hit) {
    const defs = hit?.defs || [];
    return {
        ok: true,
        lemma: key,
        definition: defs[0] || "",
        defs,
        example: hit?.example || "",
        phonetic: hit?.phonetic || "",
    };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // avoid any edge/runtime surprises with libs
export const revalidate = 0; // no caching

async function fetchExternalDefinition(raw) {
    // Try several variants: as-is, no hyphens, split-on-hyphen first part, naive lemma
    const variants = [];
    const base = normalizeTerm(raw);
    if (base) variants.push(base);
    if (base.includes("-")) {
        variants.push(base.replace(/-/g, " ")); // "spring cleaning"
        variants.push(base.replace(/-/g, ""));  // "springcleaning"
        variants.push(base.split("-")[0]);      // "spring"
    }
    // very small lemmatizer for common inflections
    const lemmaish = (w) => {
        if (w.endsWith("ies")) return w.slice(0, -3) + "y";
        if (w.endsWith("sses") || w.endsWith("shes") || w.endsWith("ches")) return w.slice(0, -2);
        if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
        if (w.endsWith("ing")) return w.replace(/ing$/, "").replace(/(.)\1$/, "$1");
        if (w.endsWith("ed")) return w.replace(/ed$/, "");
        return w;
    };
    const l = lemmaish(base);
    if (l && !variants.includes(l)) variants.push(l);

    for (const v of variants) {
        try {
            const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(v)}`, {
                // pass minimal headers; cache a bit at the edge
                headers: { "accept": "application/json" },
                cache: "no-store",
            });
            if (!r.ok) continue;
            const arr = await r.json(); // spec returns an array of entries
            const entry = Array.isArray(arr) && arr[0];
            if (!entry) continue;
            const phonetic = entry.phonetic || (entry.phonetics?.find(p => p.text)?.text) || "";
            const defs = [];
            for (const m of entry.meanings || []) {
                for (const d of m.definitions || []) {
                    if (d.definition) defs.push(d.definition);
                }
            }
            if (defs.length) {
                return {
                    ok: true,
                    lemma: v,
                    definition: defs[0],
                    defs,
                    example: (entry.meanings?.[0]?.definitions?.[0]?.example) || "",
                    phonetic,
                };
            }
        } catch { /* keep trying variants */ }
    }
    return null;
}


export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const Schema = z.object({ term: z.string().trim().min(1).max(64) });
        const parsed = Schema.safeParse({ term: searchParams.get("term") || "" });
        if (!parsed.success) {
            return Response.json({ ok: false, error: "Missing term" }, { status: 400 });
        }
        const key = normalizeTerm(parsed.data.term);
        const hit = DICT[key] || await fetchExternalDefinition(key);
        if (!hit) return Response.json({ ok: false, error: "NOT_FOUND", lemma: key }, { status: 404 });
        // Support both legacy and new shapes (LookupBubble reads either)
        const payload = toPayload(hit.lemma || key, hit);
        return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    } catch (err) {
        return Response.json({ ok: false, error: "DEFINE_GET_FAILED" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const raw = body.term || body.word || "";
        const key = normalizeTerm(raw);
        if (!key) return Response.json({ ok: false, error: "Missing term" }, { status: 400 });
        const hit = DICT[key] || await fetchExternalDefinition(key);
        if (!hit) return Response.json({ ok: false, error: "NOT_FOUND", lemma: key }, { status: 404 });
        return Response.json(toPayload(hit.lemma || key, hit), { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    } catch {
        return Response.json({ ok: false, error: "DEFINE_POST_FAILED" }, { status: 500 });
    }
}
