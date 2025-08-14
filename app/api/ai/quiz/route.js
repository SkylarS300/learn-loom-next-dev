import { cookies } from "next/headers";

export async function POST(req) {
    const enabled = process.env.AI_QUIZ_ENABLED === "true";
    if (!enabled) {
        return Response.json({ ok: false, error: "AI quiz is disabled" }, { status: 501 });
    }
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
        let { text = "", concept = "", subTopic = "", difficulty = "mixed", count = 8 } = await req.json();
        text = String(text || "").trim();
        concept = String(concept || "").trim();
        subTopic = String(subTopic || "").trim();
        count = Math.max(3, Math.min(20, Number(count) || 8));
        if (!text || !concept || !subTopic) {
            return Response.json({ ok: false, error: "Missing text / concept / subTopic" }, { status: 400 });
        }
        if (!process.env.OPENAI_API_KEY) {
            return Response.json({ ok: false, error: "OPENAI_API_KEY not set" }, { status: 501 });
        }
        // Lazy-import OpenAI so other branches don’t need the dep
        let OpenAI;
        try {
            OpenAI = (await import("openai")).default;
        } catch {
            return Response.json({ ok: false, error: "OpenAI SDK not installed. Run: npm i openai" }, { status: 501 });
        }
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const system = [
            "You generate concise English grammar multiple-choice questions.",
            "Return strict JSON with the shape: {\"items\":[{\"prompt\":\"...\",\"choices\":[\"...\",\"...\",\"...\",\"...\"],\"answerIndex\":0,\"explanation\":\"...\"}, ...]}",
            "Constraints:",
            "- Exactly 4 choices per item.",
            "- answerIndex is an integer 0..3.",
            `- Focus on concept="${concept}" and subTopic="${subTopic}".`,
            "- Use the user's text as the source; prefer sentence-level questions.",
            "- Ensure the correct choice is unambiguously correct.",
            "- Keep explanations short and clear (<=160 chars).",
        ].join("\n");

        const user = [
            `DIFFICULTY: ${difficulty}`,
            `COUNT: ${count}`,
            "SOURCE TEXT:",
            text.slice(0, 4000),
        ].join("\n\n");

        let resp;
        try {
            resp = await client.chat.completions.create({
                model: process.env.AI_QUIZ_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                temperature: 0.2,
                response_format: { type: "json_object" },
            });
        } catch (e) {
            // Map OpenAI errors to helpful HTTP codes/messages
            const code = e?.code || e?.error?.type || "";
            const status = Number(e?.status) || 502;
            if (code === "insufficient_quota" || code === "rate_limit_exceeded" || status === 429) {
                return Response.json(
                    { ok: false, error: "OpenAI quota or rate limit exceeded. Please try again later.", code: code || "rate_limited" },
                    { status: 429 }
                );
            }
            if (code === "invalid_api_key" || status === 401) {
                return Response.json(
                    { ok: false, error: "Invalid API key for AI provider.", code: "invalid_api_key" },
                    { status: 401 }
                );
            }
            console.error("ai/quiz provider error:", e);
            return Response.json(
                { ok: false, error: "AI provider error. Please try again later.", code: code || "provider_error" },
                { status: 502 }
            );
        }
        const content = resp.choices?.[0]?.message?.content || "{}";
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            return Response.json({ ok: false, error: "Bad JSON from model" }, { status: 502 });
        }
        const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
        const items = rawItems.slice(0, count).map(sanitizeItem).filter(Boolean);
        if (!items.length) {
            return Response.json({ ok: false, error: "No items produced" }, { status: 502 });
        }
        // Do not persist user text or items here; privacy-first
        return Response.json({ ok: true, items });
    } catch (e) {
        console.error("ai/quiz POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}

function sanitizeItem(it) {
    if (!it || typeof it !== "object") return null;
    const prompt = String(it.prompt || "").trim();
    const choices = Array.isArray(it.choices) ? it.choices.map((c) => String(c || "").trim()).slice(0, 4) : [];
    let answerIndex = Number(it.answerIndex);
    if (!prompt || choices.length !== 4 || !Number.isInteger(answerIndex)) return null;
    if (answerIndex < 0 || answerIndex > 3) answerIndex = 0;
    const explanation = it.explanation ? String(it.explanation).trim().slice(0, 200) : undefined;
    return { kind: "mcq", prompt, choices, answerIndex, ...(explanation ? { explanation } : {}) };
}
