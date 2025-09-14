// app/api/translate/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LT_URL = process.env.LIBRE_TRANSLATE_URL || ""; // e.g. https://libretranslate.de
const LT_KEY = process.env.LIBRE_TRANSLATE_KEY || "";

async function translateLibre(text, target = "es", source = "en") {
    if (!LT_URL) return null;
    try {
        const r = await fetch(`${LT_URL}/translate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q: text, source, target, format: "text", api_key: LT_KEY || undefined }),
        });
        if (!r.ok) return null;
        const j = await r.json();
        const translation = j?.translatedText;
        return translation ? { ok: true, translation } : null;
    } catch { return null; }
}

async function translateMyMemory(text, target = "es", source = "en") {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return null;
        const j = await r.json();
        const translation = j?.responseData?.translatedText;
        return translation ? { ok: true, translation } : null;
    } catch { return null; }
}

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const text = String(body.text || "").trim();
        const target = String(body.target || "es").slice(0, 5);
        const source = String(body.source || "en").slice(0, 5);
        if (!text) return Response.json({ ok: false, error: "Missing text" }, { status: 400 });

        const lt = await translateLibre(text, target, source);
        if (lt?.ok) return Response.json(lt, { headers: { "Cache-Control": "public, max-age=60" } });

        const mm = await translateMyMemory(text, target, source);
        if (mm?.ok) return Response.json(mm, { headers: { "Cache-Control": "public, max-age=60" } });

        return Response.json({ ok: false, error: "TRANSLATE_UNAVAILABLE" }, { status: 502 });
    } catch {
        return Response.json({ ok: false, error: "TRANSLATE_FAILED" }, { status: 500 });
    }
}
