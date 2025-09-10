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

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const Schema = z.object({ term: z.string().trim().min(1).max(64) });
        const parsed = Schema.safeParse({ term: searchParams.get("term") || "" });
        if (!parsed.success) {
            return Response.json({ ok: false, error: "Missing term" }, { status: 400 });
        }
        const key = normalizeTerm(parsed.data.term);
        const hit = DICT[key];
        if (!hit) {
            return Response.json({ ok: false, error: "NOT_FOUND", lemma: key }, { status: 404 });
        }
        return Response.json(
            toPayload(key, hit),
            { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } }
        );
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
        const hit = DICT[key];
        if (!hit) {
            return Response.json({ ok: false, error: "NOT_FOUND", lemma: key }, { status: 404 });
        }
        return Response.json(toPayload(key, hit));
    } catch {
        return Response.json({ ok: false, error: "DEFINE_POST_FAILED" }, { status: 500 });
    }
}
