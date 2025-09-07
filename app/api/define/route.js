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

export const dynamic = "force-dynamic";
