// app/api/preferences/route.js
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const DEFAULTS = {
    fontScale: 100,
    theme: "LIGHT",
    dyslexiaFont: false,
    highlightColor: "yellow",
};

const THEMES = new Set(["LIGHT", "DARK", "HIGH_CONTRAST"]);
// Accepts hex colors (#fff, #ffffff) or a short list of safe CSS color keywords —
// this value gets used directly as a CSS value, so it's allow-listed rather than
// accepting arbitrary strings.
const COLOR_KEYWORDS = new Set(["yellow", "orange", "pink", "lightgreen", "lightblue", "khaki"]);
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidColor(v) {
    return typeof v === "string" && (HEX_COLOR_RE.test(v) || COLOR_KEYWORDS.has(v));
}

// GET is intentionally anonymous-friendly: pages across the whole app (including
// public ones like "/") apply these preferences on load, and a visitor without a
// code yet should just get sensible defaults rather than a 401.
export async function GET() {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value;
        if (!anonId) {
            return Response.json({ ok: true, data: DEFAULTS }, { headers: { "Cache-Control": "no-store" } });
        }

        const row = await prisma.preference.findUnique({ where: { anonId } });
        return Response.json(
            { ok: true, data: row ? {
                fontScale: row.fontScale,
                theme: row.theme,
                dyslexiaFont: row.dyslexiaFont,
                highlightColor: row.highlightColor,
            } : DEFAULTS },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (e) {
        console.error("preferences GET failed:", e);
        // Fail soft — a broken preferences fetch shouldn't break the rest of the page.
        return Response.json({ ok: true, data: DEFAULTS }, { headers: { "Cache-Control": "no-store" } });
    }
}

export async function PUT(req) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { }

    const fontScale = Math.max(80, Math.min(200, Math.round(Number(body.fontScale) || DEFAULTS.fontScale)));
    const theme = THEMES.has(body.theme) ? body.theme : DEFAULTS.theme;
    const dyslexiaFont = !!body.dyslexiaFont;
    const highlightColor = isValidColor(body.highlightColor) ? body.highlightColor : DEFAULTS.highlightColor;

    try {
        const row = await prisma.preference.upsert({
            where: { anonId },
            update: { fontScale, theme, dyslexiaFont, highlightColor },
            create: { anonId, fontScale, theme, dyslexiaFont, highlightColor },
        });
        return Response.json({ ok: true, data: row });
    } catch (e) {
        console.error("preferences PUT failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
