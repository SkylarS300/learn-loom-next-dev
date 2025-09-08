//app/api/translate/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
    const { text, to = "auto" } = await req.json().catch(() => ({}));
    if (!text) return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "Translate service not configured" }, { status: 501 });
    try {
        const prompt = `Translate to the user's likely native language from English. Keep it short.\nText: ${text}`;
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2
            })
        });
        const j = await r.json();
        const out = j?.choices?.[0]?.message?.content?.trim() || "";
        return NextResponse.json({ ok: true, translation: out });
    } catch {
        return NextResponse.json({ ok: false, error: "Translate failed" }, { status: 500 });
    }
}
